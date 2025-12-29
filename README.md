# outstanding

List all your GitHub PRs that are currently open.

Requires NodeJS 24.x or newer.

## Usage

You can install this tool for easy usage (providing your shell can see your installed npm bins):

```sh
yarn dlx "outstanding@https://github.com/half-shot/outstanding" half-shot,matrix-org half-shot/outstanding
```

## Example

```sh
$ yarn dlx https://github.com/Half-Shot/outstanding half-shot,matrix-org half-shot/outstanding
ℹ Loading initial info from GitHub
ℹ Loading 3 PRs for Half-Shot
✔ Found all PRs!

  ┌───────────────────────────────┬───────────┬───────────────────┬─────────────┬───────────────────────────────────────────────────────┐
  │          repository           │ createdAt │       state       │    title    │                                 url                   │
  ├───────────────────────────────┼───────────┼───────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ repository-a                  │  21 days  │     APPROVED      │ Title One   │ https://github.com/half-shot/repository-a/pull/123    │
  ├───────────────────────────────┼───────────┼───────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ repository-b                  │  8 days   │    UNREVIEWED     │ Title Two   │ https://github.com/half-shot/repository-b/pull/456    │
  ├───────────────────────────────┼───────────┼───────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │ other-project                 │  18 days  │       DRAFT       │ Title Three │ https://github.com/matrix-org/other-project/pull/1234 │
  ├───────────────────────────────┼───────────┼───────────────────┼─────────────┼───────────────────────────────────────────────────────┤
  │             TOTAL             │    3      │      SKIPPED      │             │                           0                           │
  └───────────────────────────────┴───────────┴───────────────────┴─────────────┴───────────────────────────────────────────────────────┘
Run again? (Y/N)
```