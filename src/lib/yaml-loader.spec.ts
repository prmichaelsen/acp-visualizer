import { describe, it, expect } from 'vitest'
import { parseProgressYaml } from './yaml-loader'

describe('parseProgressYaml', () => {
  it('parses a complete progress.yaml', () => {
    const yaml = `
project:
  name: test-project
  version: 1.0.0
  started: "2026-01-01"
  status: in_progress
  current_milestone: milestone_1
  description: A test project

milestones:
  - id: milestone_1
    name: First Milestone
    status: in_progress
    progress: 50
    started: "2026-01-01"
    tasks_completed: 1
    tasks_total: 2

tasks:
  milestone_1:
    - id: task_1
      name: First Task
      status: completed
      file: agent/tasks/task-1.md
      estimated_hours: "2"
      completed_date: "2026-01-02"
    - id: task_2
      name: Second Task
      status: not_started

recent_work:
  - date: "2026-01-02"
    description: Did stuff
    items:
      - item 1
      - item 2

next_steps:
  - Do next thing

notes:
  - A note

current_blockers: []

progress:
  planning: 100
  implementation: 50
  overall: 60
`
    const result = parseProgressYaml(yaml)

    expect(result.project.name).toBe('test-project')
    expect(result.project.version).toBe('1.0.0')
    expect(result.project.status).toBe('in_progress')
    expect(result.milestones).toHaveLength(1)
    expect(result.milestones[0].name).toBe('First Milestone')
    expect(result.milestones[0].progress).toBe(50)
    expect(result.tasks.milestone_1).toHaveLength(2)
    expect(result.tasks.milestone_1[0].status).toBe('completed')
    expect(result.tasks.milestone_1[1].status).toBe('not_started')
    expect(result.recent_work).toHaveLength(1)
    expect(result.recent_work[0].items).toEqual(['item 1', 'item 2'])
    expect(result.next_steps).toEqual(['Do next thing'])
    expect(result.progress.overall).toBe(60)
  })

  it('handles empty/minimal YAML', () => {
    const result = parseProgressYaml('')
    expect(result.project.name).toBe('Unknown')
    expect(result.milestones).toEqual([])
    expect(result.tasks).toEqual({})
  })

  it('handles totally invalid YAML', () => {
    const result = parseProgressYaml('{{{{not yaml at all')
    expect(result.project.name).toBe('Unknown')
    expect(result.milestones).toEqual([])
  })

  it('handles missing sections gracefully', () => {
    const yaml = `
project:
  name: minimal
`
    const result = parseProgressYaml(yaml)
    expect(result.project.name).toBe('minimal')
    expect(result.project.status).toBe('not_started')
    expect(result.milestones).toEqual([])
    expect(result.tasks).toEqual({})
    expect(result.next_steps).toEqual([])
    expect(result.notes).toEqual([])
    expect(result.current_blockers).toEqual([])
  })

  it('fuzzy-matches status values', () => {
    const yaml = `
milestones:
  - id: m1
    name: Done One
    status: done
  - id: m2
    name: Active One
    status: active
  - id: m3
    name: WIP One
    status: wip
  - id: m4
    name: In Progress One
    status: "in progress"
  - id: m5
    name: Complete One
    status: complete
  - id: m6
    name: Started One
    status: started
`
    const result = parseProgressYaml(yaml)
    expect(result.milestones[0].status).toBe('completed')
    expect(result.milestones[1].status).toBe('in_progress')
    expect(result.milestones[2].status).toBe('in_progress')
    expect(result.milestones[3].status).toBe('in_progress')
    expect(result.milestones[4].status).toBe('completed')
    expect(result.milestones[5].status).toBe('in_progress')
  })

  it('preserves unknown properties in extra fields', () => {
    const yaml = `
project:
  name: test
  custom_field: hello
  priority: high

milestones:
  - id: m1
    name: Test
    status: in_progress
    risk_level: high
    owner: alice
`
    const result = parseProgressYaml(yaml)
    expect(result.project.extra).toEqual({ custom_field: 'hello', priority: 'high' })
    expect(result.milestones[0].extra).toEqual({ risk_level: 'high', owner: 'alice' })
  })

  it('resolves key aliases', () => {
    const yaml = `
tasks:
  m1:
    - id: t1
      title: Aliased Name
      est_hours: "4"
      done_date: "2026-01-05"
      path: agent/tasks/t1.md
`
    const result = parseProgressYaml(yaml)
    const task = result.tasks.m1[0]
    expect(task.name).toBe('Aliased Name')
    expect(task.estimated_hours).toBe('4')
    expect(task.completed_date).toBe('2026-01-05')
    expect(task.file).toBe('agent/tasks/t1.md')
  })

  it('coerces string-for-array', () => {
    const yaml = `
next_steps: "just one step"
notes: "single note"
`
    const result = parseProgressYaml(yaml)
    expect(result.next_steps).toEqual(['just one step'])
    expect(result.notes).toEqual(['single note'])
  })

  it('generates IDs when missing', () => {
    const yaml = `
milestones:
  - name: No ID Milestone
    status: not_started
`
    const result = parseProgressYaml(yaml)
    expect(result.milestones[0].id).toBe('milestone_1')
  })

  it('maps task keys to milestone IDs when formats differ', () => {
    const yaml = `
milestones:
  - id: M1
    name: First
    status: completed
  - id: M2
    name: Second
    status: in_progress

tasks:
  milestone_1:
    - id: t1
      name: Task A
      status: completed
  milestone_2:
    - id: t2
      name: Task B
      status: in_progress
`
    const result = parseProgressYaml(yaml)
    // Tasks keyed as milestone_1 should map to milestone ID M1
    expect(result.tasks['M1']).toHaveLength(1)
    expect(result.tasks['M1'][0].name).toBe('Task A')
    expect(result.tasks['M2']).toHaveLength(1)
    expect(result.tasks['M2'][0].name).toBe('Task B')
  })

  it('handles null values in dates', () => {
    const yaml = `
milestones:
  - id: m1
    name: Test
    started: null
    completed: null
`
    const result = parseProgressYaml(yaml)
    expect(result.milestones[0].started).toBeNull()
    expect(result.milestones[0].completed).toBeNull()
  })
})
