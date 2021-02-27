# 🙌 Contributing to Google Assistant Unofficial Desktop Client

Welcome to Google Assistant Unofficial Desktop Client 👋 Thanks for deciding to read this guide and contribute!
**Remember:** You don't need to think big even a typo fix might save our day and make you a hero.
Every contribution counts! 🔥

## 🐛 Found a Bug?

If you find a bug, you can contribute by submitting an issue [here](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues/new?assignees=&labels=Type%3A+Bug&template=bug-report.md&title=%F0%9F%90%9B+BUG%3A+)

**Note:** Before creating a bug report issue, check if someone else has already submitted the particular issue [here](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues). If you do find one, give it a thumbs up to let us know the serverity of the bug. If you have additional info related to the bug, you may comment within the same issue.

## 💡 Have a Great Idea?

Have a feature in your mind that is missing? Share your thoughts with us by submitting an issue [here](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues/new?assignees=&labels=Type%3A+Feature&template=feature-request.md&title=%F0%9F%92%A1+FEATURE+REQUEST%3A+).

**Note:** Before creating a suggestion issue, check if someone else has already submitted the particular suggestion [here](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues). If you do find one, give it a thumbs up to let us know the priority of the feature.

## 📙 Contribution Guideline

### Submitting an Issue

Before submitting your issue, please check that it was not reported already (open or closed) [here](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues). To narrow down the list to the issues that are frequently encountered by others check the [Frequently Asked Questions (FAQ)](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/wiki/Frequently-Asked-Questions-(FAQ)) or [duplicate issues](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues?q=is%3Aissue+label%3Aduplicate+is%3Aclosed).

Also provide as many details as possible to make things easier.

### Submitting a Pull Request

How to submit a pull request?

> Before you start, you will need to install [`git`](https://git-scm.com/) if not already installed in your machine.

#### TL;DR

1. Fork the repository.
2. Checkout a topic branch for your submission.
3. Push your new branch to GitHub.
4. Submit a pull request to the `master` branch.

#### Detailed guide

1. Fork the project.

2. Clone the fork on your machine.

   ```console
   $ git clone https://github.com/<Your-Username>/Google-Assistant-Unofficial-Desktop-Client.git
   ```

3. Open Command Prompt/Terminal in the root of this project.

4. Type the following (_This is just a one-time thing_)

   ```console
   $ git remote add upstream https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client.git
   ```

5. Pull lastest changes from the upstream repository if there are any new commits:

   ```console
   $ git pull upstream master
   ```

6. Checkout a topic branch for your submission.

    ```console
    $ git checkout -b feature/<some-feature-name>
    ```

7. Make appropriate changes to the code. Stage the files that you want to commit and then commit the changes with a proper commit message (you may refer [Commit Messages](#Commit-Messages)):

   ```console
   $ git commit -m "<Your-Commit-Message>"
   ```

8. Pull lastest changes from the upstream repository as specified in _Step 5_.

9. For the most part the previous step will automatically merge all the changes from upstream. If it doesn't, it will give you Merge Conflict error wherein you need to manually resolve those conflicts.

10. Finally, make a pull request from your fork to this repository.

### Coding Styles

Thinking about the contributors, Google Assistant Unofficial Desktop Client follows some coding rules to enforce/keep the linting and code simple, readable, and understandable. Also, it's essential to:

1. Have the [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode) extension installed in your Editor.

2. Make sure you have this line in your `settings.json` file to set the Prettier extension as default formatter. This would enforce the `.prettierrc` formatting to your code when you format:

    ```json
    "editor.defaultFormatter": "esbenp.prettier-vscode"
    ```

3. Check the [AirBnb JavaScript style guide](https://github.com/airbnb/javascript)

### Commit Messages

Google Assistant Unofficial Desktop Client commit messages follows a pattern. So, to make sure everything is consistent and understandable, check out:

1. [Semantic Commit Messages _(gist by joshbuchea)_](https://gist.github.com/joshbuchea/6f47e86d2510bce28f8e7f42ae84c716)
2. [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/)

### How to Build

Once you have cloned the repository, you can run/build this app locally on your own. Before you start, make sure you have [node.js](https://nodejs.org/) installed on your machine.

If you are on **Windows**, you must install _Windows Build Tools_ to build native modules. Install the build tools with this one-liner. Start PowerShell as **Administrator** and run:

```console
> npm install --global windows-build-tools
```

Or, if you are using Yarn:

```console
> yarn global add windows-build-tools
```

Now that you are ready with the pre-requisites, you can type the following to get up and running.

#### Using `npm`
----------------

```bash
# Get dependencies from npm (mandatory)
npm install

# Run the Assistant
npm start

# Build the Assistant
npm run dist
```

#### Using `yarn`
-----------------

```bash
# Get dependencies from npm registry (mandatory)
yarn

# Run the Assistant
yarn start

# Build the Assistant
yarn dist
```

Make sure you have the authentication part set up for testing your code. Refer the [Setup Authentication for Google Assistant Unofficial Desktop Client](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/wiki/Setup-Authentication-for-Google-Assistant-Unofficial-Desktop-Client) guide for setting things up.

Once again, thank you for joining this journey and good luck contributing 🙏
