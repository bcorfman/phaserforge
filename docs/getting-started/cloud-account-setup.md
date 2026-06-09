# Cloud Account Setup

This is the first workflow a new PhaserForge user should complete.

1. create your PhaserForge account with an email invite code, or log in if you already have an account
2. confirm you are signed in
3. connect the GitHub account you want PhaserForge to publish through

## What You Need Before You Start

- a running PhaserForge session
- your email address
- an invite code if you are creating your account for the first time
- the GitHub account you intend to use for publishing

**NOTE:** If you do not already have a GitHub personal account:
1. open GitHub's official account-creation guide: [Creating an account on GitHub](https://docs.github.com/en/get-started/start-your-journey/creating-an-account-on-github)
2. complete the GitHub signup flow and verify your email address
3. return to PhaserForge and continue with the connection steps below

## 1. Open the Cloud Pane

Open the `Cloud` tab in the right-side pane. 

When the account section appears:

- first-time users should expect the `Create` tab to be selected by default
- returning users who already created a PhaserForge account should expect the `Log in` tab to be selected by default

## 2a. Create Your Account with the Invite Code

If you do not already have a PhaserForge account:

1. stay on the default `Create` tab
2. enter your email
3. enter your password
4. enter the invite code
5. submit the form

<img src="../assets/screenshots/playwright/cloud-account-signup.png" alt="Cloud account create-account form" width="708" />

<p align="center"><em>Figure 1. Cloud account create form.</em></p>

Success check:
- The account flow accepts your signup and you land in a signed-in state.

## 2b. Log In

<img src="../assets/screenshots/playwright/cloud-account-login.png" alt="Cloud account log in form" width="708" />

<p align="center"><em>Figure 2. Cloud account log in form.</em></p>

If you already have a PhaserForge account:

1. confirm the `Log in` tab is already selected, or switch to it if needed
2. enter your email
3. enter your password
4. submit the form

Success check:
- The Cloud pane shows you as signed in.

## 3. Connect GitHub

After you are signed in, connect the GitHub account you want PhaserForge to use for publishing.

Use the Cloud pane action for:

- `Connect GitHub` if no GitHub account is linked yet
- `Switch GitHub…` if the wrong GitHub account is currently linked

Continue through the GitHub authorization flow in the browser. Figure 3 shows the signed-in, GitHub-linked state you want before moving on to project work.

<img src="../assets/screenshots/playwright/cloud-account-linked.png" alt="Cloud account signed-in and GitHub-linked state" width="708" />

<p align="center"><em>Figure 3. Cloud account signed-in and GitHub-linked state.</em></p>

Success check:
- The Cloud pane reports that GitHub is connected.
- The publish section no longer asks you to connect GitHub first.

## 4. Confirm You Are Ready for the Normal Workflow

Before you move on, make sure all three conditions are true:

- you are signed in to PhaserForge
- GitHub is connected
- the Cloud pane publish section is available

At that point, you are on the intended first-user path.

## What to Do Next

Continue to [Build the Pattern Demo](./pattern-demo).
