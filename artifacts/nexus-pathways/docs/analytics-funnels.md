# Curriculum engagement analytics

These events connect staff curriculum activity to learner engagement while avoiding course titles, course or cohort identifiers, learner identities, change notes, and other free-form content.

## Events

| Description | Event name | Safe properties |
| --- | --- | --- |
| A course lifecycle transition successfully publishes a course | `course_published` | `previous_lifecycle`, `publication_path` |
| A course is successfully assigned to a cohort | `course_assigned_to_cohort` | `assignment_action` |
| A learner successfully loads an assigned course | `learner_course_opened` | `has_navigable_content` |
| A learner selects course content from the syllabus | `course_content_navigated` | `content_type`, `navigation_source` |

All properties are controlled categories or booleans. Failed operations and unassignment actions are not counted as positive funnel outcomes.

## Recommended funnels

### Publish to learner open

1. `course_published`
2. `learner_course_opened`

Compare event totals in the same reporting window and trend the ratio of learner opens to publications over time. Segment publications by `publication_path` to compare approved publishing with direct publishing.

This is an aggregate cross-role funnel. It intentionally does not correlate a specific course, staff member, cohort, or learner.

### Assignment to learner open

1. `course_assigned_to_cohort`
2. `learner_course_opened`

Compare assignment and open totals by day or week. A rising open-to-assignment ratio indicates that newly available curriculum is reaching learners. Allow for a lag between staff assignment and learner access when choosing the reporting window.

### Learner open to content navigation

1. `learner_course_opened`
2. `course_content_navigated`

Segment the second step by `content_type` to see whether learners choose activities or assessments. Use `has_navigable_content` on course opens to exclude structures with no activities or assessments when diagnosing low navigation rates.

## Analytics transport

Replit injects the Umami tracker into published website artifacts after analytics is enabled in Publishing settings. The app must not bundle a tracker script, website ID, endpoint, or analytics environment variables. Calls safely do nothing during local development, before the injected tracker loads, or when analytics has not been enabled.

## Privacy boundary

Do not add titles, IDs, names, notes, instructions, content text, URL parameters, or user attributes to these events. If course-level attribution is needed later, introduce a reviewed, non-reversible analytics grouping strategy rather than sending operational identifiers.