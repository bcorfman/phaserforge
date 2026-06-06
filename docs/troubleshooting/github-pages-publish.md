# GitHub Pages Publish Troubleshooting

Use this page when the Cloud pane publish flow does not complete the way you expect.

## Publish Button Stays Disabled

Check these first:

- the project has a title
- the repository name field is filled in
- you are signed in
- GitHub is connected

If the publish target preview is missing, correct the repository field before trying again.

## GitHub Is Not Connected

If the Cloud pane asks you to connect GitHub, complete that step before attempting Pages publish. The publish flow depends on GitHub access and repository permissions.

## GitHub Pages Permission Errors

If PhaserForge reports that GitHub denied Pages management access:

- verify that you connected the correct GitHub account
- reconnect GitHub if permissions may have changed
- check whether the target repository is owned by a different account or organization

## Repository Already Exists

This is not always an error. Read the precheck result carefully:

- if you intend to update that repository, confirm the publish
- if you do not intend to update it, stop and change the repository name

## GitHub Site Returns 404

Possible causes:

- the deployment has not finished yet
- GitHub Pages is still being configured on first publish
- the publish targeted a different repository than you expected

Wait briefly, refresh, and compare the Cloud pane target URL with the repository you actually published.

## Local Project Looks Right but Published Site Does Not

Check these:

- verify you saved the latest project state before publishing
- rerun publish after confirming the project title and repository name
- open the local project again and confirm the expected scene content is still there
