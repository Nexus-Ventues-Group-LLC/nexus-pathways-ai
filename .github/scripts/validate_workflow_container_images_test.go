package main

import "testing"

func assertValid(t *testing.T, workflow string) {
	t.Helper()
	if errors := validateWorkflow("workflow.yml", []byte(workflow)); len(errors) != 0 {
		t.Fatalf("expected workflow to be valid, got %v", errors)
	}
}

func assertInvalid(t *testing.T, workflow string) {
	t.Helper()
	if errors := validateWorkflow("workflow.yml", []byte(workflow)); len(errors) == 0 {
		t.Fatal("expected workflow to be invalid")
	}
}

func TestAcceptsPinnedServiceAndJobContainers(t *testing.T) {
	assertValid(t, `
jobs:
  service:
    services:
      postgres:
        image: postgres:16.15@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # PostgreSQL 16
  inline-container:
    container: node:22.19.0@sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb # Node.js 22
  nested-container:
    container:
      image: node:22.19.0@sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc # Node.js 22
`)
}

func TestRejectsMutableContainerImages(t *testing.T) {
	workflows := map[string]string{
		"service": `
jobs:
  test:
    services:
      postgres:
        image: postgres:latest
`,
		"inline job container": `
jobs:
  test:
    container: node:22
`,
		"nested job container": `
jobs:
  test:
    container:
      image: node:22
`,
	}

	for name, workflow := range workflows {
		t.Run(name, func(t *testing.T) {
			assertInvalid(t, workflow)
		})
	}
}

func TestRejectsDigestWithoutVersionComment(t *testing.T) {
	assertInvalid(t, `
jobs:
  test:
    container: node:22@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
`)
}

func TestRejectsMutableImagesInFlowMappings(t *testing.T) {
	workflows := map[string]string{
		"service": `
jobs: { test: { services: { postgres: { image: postgres:latest } } } }
`,
		"job container": `
jobs: { test: { container: { image: node:22 } } }
`,
	}

	for name, workflow := range workflows {
		t.Run(name, func(t *testing.T) {
			assertInvalid(t, workflow)
		})
	}
}

func TestRejectsMutableImagesWithQuotedKeys(t *testing.T) {
	workflows := map[string]string{
		"quoted jobs": `
"jobs":
  test:
    container: node:22
`,
		"quoted services": `
jobs:
  test:
    "services":
      postgres:
        image: postgres:latest
`,
		"quoted service image": `
jobs:
  test:
    services:
      postgres:
        "image": postgres:latest
`,
		"quoted container": `
jobs:
  test:
    "container": node:22
`,
		"quoted nested container image": `
jobs:
  test:
    container:
      "image": node:22
`,
	}

	for name, workflow := range workflows {
		t.Run(name, func(t *testing.T) {
			assertInvalid(t, workflow)
		})
	}
}

func TestRejectsDuplicateAndMergedImageKeys(t *testing.T) {
	workflows := map[string]string{
		"duplicate image": `
jobs:
  test:
    services:
      postgres:
        image: postgres:16@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # PostgreSQL 16
        image: postgres:latest
`,
		"semantically duplicate quoted image": `
jobs:
  test:
    services:
      postgres:
        image: postgres:16@sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa # PostgreSQL 16
        "image": postgres:latest
`,
		"merge key": `
defaults: &defaults
  container: node:22
jobs:
  test:
    <<: *defaults
`,
	}

	for name, workflow := range workflows {
		t.Run(name, func(t *testing.T) {
			assertInvalid(t, workflow)
		})
	}
}
