package main

import (
	"errors"
	"fmt"
	"os"
	"regexp"
	"strings"

	"gopkg.in/yaml.v3"
)

var pinnedImage = regexp.MustCompile(`^\S+@sha256:[0-9a-fA-F]{64}$`)

func nodeLine(node *yaml.Node) int {
	if node == nil {
		return 0
	}
	return node.Line
}

func resolved(node *yaml.Node) *yaml.Node {
	for node != nil && node.Kind == yaml.AliasNode {
		node = node.Alias
	}
	return node
}

func mappingValue(node *yaml.Node, key string) *yaml.Node {
	node = resolved(node)
	if node == nil || node.Kind != yaml.MappingNode {
		return nil
	}

	for index := 0; index < len(node.Content); index += 2 {
		if node.Content[index].Value == key {
			return resolved(node.Content[index+1])
		}
	}
	return nil
}

func validateMappingKeys(path string, node *yaml.Node, visited map[*yaml.Node]bool) []error {
	node = resolved(node)
	if node == nil || visited[node] {
		return nil
	}
	visited[node] = true

	var validationErrors []error
	switch node.Kind {
	case yaml.MappingNode:
		seen := make(map[string]bool)
		for index := 0; index < len(node.Content); index += 2 {
			key := resolved(node.Content[index])
			value := resolved(node.Content[index+1])
			if key == nil || key.Kind != yaml.ScalarNode {
				validationErrors = append(
					validationErrors,
					fmt.Errorf("%s:%d: mapping keys must be scalars", path, nodeLine(key)),
				)
			} else if key.Value == "<<" {
				validationErrors = append(
					validationErrors,
					fmt.Errorf("%s:%d: YAML merge keys are not allowed", path, key.Line),
				)
			} else if seen[key.Value] {
				validationErrors = append(
					validationErrors,
					fmt.Errorf("%s:%d: duplicate mapping key %q is not allowed", path, key.Line, key.Value),
				)
			} else {
				seen[key.Value] = true
			}
			validationErrors = append(
				validationErrors,
				validateMappingKeys(path, value, visited)...,
			)
		}
	case yaml.SequenceNode:
		for _, child := range node.Content {
			validationErrors = append(
				validationErrors,
				validateMappingKeys(path, child, visited)...,
			)
		}
	}
	return validationErrors
}

func validateImage(path string, node *yaml.Node) error {
	node = resolved(node)
	if node == nil || node.Kind != yaml.ScalarNode {
		return fmt.Errorf("%s:%d: container image must be a scalar", path, nodeLine(node))
	}
	if !pinnedImage.MatchString(node.Value) || strings.TrimSpace(node.LineComment) == "" {
		return fmt.Errorf(
			"%s:%d: container images must use a full sha256 digest and an inline readable version comment",
			path,
			node.Line,
		)
	}
	return nil
}

func validateJob(path string, job *yaml.Node) []error {
	job = resolved(job)
	if job == nil || job.Kind != yaml.MappingNode {
		return []error{fmt.Errorf("%s:%d: job definition must be a mapping", path, nodeLine(job))}
	}

	var validationErrors []error
	if container := mappingValue(job, "container"); container != nil {
		image := container
		if container.Kind == yaml.MappingNode {
			image = mappingValue(container, "image")
		}
		if image == nil {
			validationErrors = append(
				validationErrors,
				fmt.Errorf("%s:%d: job container must define an image", path, container.Line),
			)
		} else if err := validateImage(path, image); err != nil {
			validationErrors = append(validationErrors, err)
		}
	}

	services := mappingValue(job, "services")
	if services == nil {
		return validationErrors
	}
	if services.Kind != yaml.MappingNode {
		return append(
			validationErrors,
			fmt.Errorf("%s:%d: services definition must be a mapping", path, services.Line),
		)
	}

	for index := 0; index < len(services.Content); index += 2 {
		service := resolved(services.Content[index+1])
		image := mappingValue(service, "image")
		if image == nil {
			validationErrors = append(
				validationErrors,
				fmt.Errorf("%s:%d: service must define an image", path, service.Line),
			)
		} else if err := validateImage(path, image); err != nil {
			validationErrors = append(validationErrors, err)
		}
	}
	return validationErrors
}

func validateWorkflow(path string, contents []byte) []error {
	var document yaml.Node
	if err := yaml.Unmarshal(contents, &document); err != nil {
		return []error{fmt.Errorf("%s: invalid YAML: %w", path, err)}
	}
	if len(document.Content) != 1 {
		return []error{fmt.Errorf("%s: workflow must contain one YAML document", path)}
	}

	validationErrors := validateMappingKeys(
		path,
		document.Content[0],
		make(map[*yaml.Node]bool),
	)
	jobs := mappingValue(document.Content[0], "jobs")
	if jobs == nil {
		return validationErrors
	}
	if jobs.Kind != yaml.MappingNode {
		return append(
			validationErrors,
			fmt.Errorf("%s:%d: jobs definition must be a mapping", path, jobs.Line),
		)
	}

	for index := 0; index < len(jobs.Content); index += 2 {
		validationErrors = append(
			validationErrors,
			validateJob(path, jobs.Content[index+1])...,
		)
	}
	return validationErrors
}

func run(paths []string) error {
	if len(paths) == 0 {
		return errors.New("usage: workflow-validation WORKFLOW...")
	}

	var validationErrors []error
	for _, path := range paths {
		contents, err := os.ReadFile(path)
		if err != nil {
			validationErrors = append(validationErrors, fmt.Errorf("%s: %w", path, err))
			continue
		}
		validationErrors = append(validationErrors, validateWorkflow(path, contents)...)
	}
	return errors.Join(validationErrors...)
}

func main() {
	if err := run(os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
