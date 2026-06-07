# Cloud Account Setup

This is the first workflow a new PhaserForge user should complete. The normal path is cloud-first:

1. create your PhaserForge account with an email invite code, or log in if you already have one
2. confirm you are signed in
3. connect the GitHub account you want PhaserForge to publish through

Offline-only use is possible, but it should be treated as an exception, not the primary onboarding path.

## What You Need Before You Start

- a running PhaserForge session
- your email address
- an invite code if you are creating your account for the first time
- the GitHub account you intend to use for publishing

The relevant workflow family in the [Editor Workflow Reference](../reference/editor-workflows) is:

- **A62 — Switch Inspector / Cloud Pane**
- **A63 — Cloud Account Access**
- **A65 — Connect / Switch / Disconnect GitHub**

## 1. Open the Cloud Pane

In the right-side pane, switch from `Inspector` to `Cloud`. Figure 1 shows the signed-out Cloud pane state you should expect before account work begins.

Figure 1. Cloud pane before sign-in.

![Cloud pane signed-out state](../assets/screenshots/playwright/cloud-account-login.png)

Success check:
- You can see the account section and the publish section.

## 2. Create Your Account with the Invite Code

If you do not already have a PhaserForge account:

1. choose `Create account`
2. enter your email
3. enter your password
4. enter the invite code
5. submit the form

If you already have an account, skip this step and go straight to login.

Figure 2 shows the `Create account` mode with the invite-code field visible.

Figure 2. Cloud account create-account form.

![Cloud account create-account form](../assets/screenshots/playwright/cloud-account-signup.png)

Success check:
- The account flow accepts your signup and you land in a signed-in state.

## 3. Log In

If you already have an account, use the default `Log in` tab instead:

1. choose `Log in`
2. enter your email
3. enter your password
4. submit the form

If you just created your account in the previous step, you should already be signed in and can skip straight to GitHub connection.

PhaserForge should treat a signed-in account as the normal operating mode for real work, project persistence, and publishing.

Success check:
- The Cloud pane shows you as signed in.

## 4. Connect GitHub

After you are signed in, connect the GitHub account you want PhaserForge to use for publishing.

Use the Cloud pane action for:

- `Connect GitHub` if no GitHub account is linked yet
- `Switch GitHub…` if the wrong GitHub account is currently linked

Continue through the GitHub authorization flow in the browser. Figure 3 shows the signed-in, GitHub-linked state you want before moving on to project work.

Figure 3. Cloud account signed-in and GitHub-linked state.

![Cloud account signed-in and GitHub-linked state](../assets/screenshots/playwright/cloud-account-linked.png)

Success check:
- The Cloud pane reports that GitHub is connected.
- The publish section no longer asks you to connect GitHub first.

## 5. Confirm You Are Ready for the Normal Workflow

Before you move on, make sure all three conditions are true:

- you are signed in to PhaserForge
- GitHub is connected
- the Cloud pane publish section is available

At that point, you are on the intended first-user path.

## What to Do Next

Continue to [Build the Pattern Demo](./pattern-demo).
