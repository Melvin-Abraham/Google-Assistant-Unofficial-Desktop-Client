# Google Assistant Unofficial Desktop Client

[![Build](https://img.shields.io/github/workflow/status/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/nodejs-ci?logo=github&style=for-the-badge)][build]
[![Downloads](https://img.shields.io/github/downloads/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/total.svg?logo=github&style=for-the-badge)][downloads]
[![Issues](https://img.shields.io/github/issues/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client.svg?logo=github&style=for-the-badge)][issues]
[![License](https://img.shields.io/github/license/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client.svg?style=for-the-badge&color=blue)][license]
[![Top Language](https://img.shields.io/github/languages/top/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client.svg?style=for-the-badge&color=yellow)][top-lang]
[![Last Commit](https://img.shields.io/github/last-commit/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client.svg?style=for-the-badge)][commits]
[![Commits since last release](https://img.shields.io/github/commits-since/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/latest.svg?style=for-the-badge)][commits]
[![Milestone v2.0.0](https://img.shields.io/badge/Milestone%20v2.0.0-Next-blueviolet?style=for-the-badge)][next-milestone]

![G Assist Banner](images/Banner.png)

Google Assistant Unofficial Desktop Client is a cross-platform desktop client for Google Assistant based on **Google Assistant SDK**.

> Note:
> ---
>
> The **"Google Assistant Unofficial Desktop Client"** is under development. So, if you find any bugs or have any suggestion, feel free to post an _issue_ or a _pull request_.

## Inspiration

The design is inspired by Google Assistant in Chrome OS and comes in both Light Mode _(beta)_ and Dark Mode 😉.

![G Assist Screenshot](images/Assistant_light_dark.jpg)

## Download

You can build the assistant on your machine if you prefer _(see [How to Build](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/blob/master/CONTRIBUTING.md#how-to-build))_. If you don't want to build the project for yourself, you can download the Assistant Setup/Installer for the respective platform from [here (releases)](https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/releases). You can download from other official sources as well.

### Windows (using `winget`)

> If you are on **Windows 11**, chances are you have `winget` pre-installed.
> If you are on older version of Windows (Windows 10) and don't have it installed, check out
> [Install Winget](https://docs.microsoft.com/en-us/windows/package-manager/winget/#install-winget)
> documentation section to learn how to install it.

#### ⚡ Stable versions:

```powershell
PS> winget install "g-assist" -e
```

#### 🧪 Preview Versions (Pre-release versions):

```powershell
PS> winget install "g-assist-preview" -e
```

### MacOS (using `brew`)

> Visit [brew.sh](https://brew.sh/) to learn how to install `brew` if you don't have it
> installed on your machine.

```console
$ brew install --cask google-assistant
```

### Arch Linux (using AUR)

#### Using AUR Helpers

##### [Yay](https://github.com/Jguer/yay)

```console
$ yay -S google-assistant-unofficial-desktop-bin
```

##### [Paru](https://github.com/Morganamilo/paru)

```console
$ paru -S google-assistant-unofficial-desktop-bin
```

#### Manual

```console
$ git clone https://aur.archlinux.org/google-assistant-unofficial-desktop-client-bin.git
$ cd google-assistant-unofficial-desktop-client-bin
$ makepkg -si
```

### Linux (using `snap`)

> Some linux distros like Ubuntu, KDE Neon, Manjaro, Zorin OS, etc. come pre-installed with
> `snap`. For distros without out-of-the-box support for snaps, visit [Installing snapd](https://snapcraft.io/docs/installing-snapd)
> documentation page.

Manually download from the Snapstore:

[![Get it from the Snap Store](https://snapcraft.io/static/images/badges/en/snap-store-black.svg)](https://snapcraft.io/g-assist)

#### ⚡ Stable versions:

```console
$ sudo snap install g-assist
```

#### 🧪 Preview versions (Pre-release versions):

If you want to install release candidates:

```console
$ sudo snap install g-assist --candidate
```

If you want to install beta versions:

```console
$ sudo snap install g-assist --beta
```

## Getting Started

In order to use the client, you must have a _"Key File"_ and _"Token"_ for authentication which you can get by going through **Device Registration** process. You can go through the wiki given below to get started.

"*Setup Authentication for Google Assistant Unofficial Desktop Client*" Wiki (For both **Device Registration** & **Authentication** help):
> https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/wiki/Setup-Authentication-for-Google-Assistant-Unofficial-Desktop-Client

#### Other References

If you want a user friendly registration method, use **Device Registration** UI:
> https://developers.google.com/assistant/sdk/guides/library/python/embed/config-dev-project-and-account

If you want to use a CLI tool to complete the **Device Registration** and **Authentication** process manually, read the following:
> https://developers.google.com/assistant/sdk/reference/device-registration/register-device-manual

After you have registered your device and downloaded the required authentication files, you can head on to _Settings_ and set the _"Key File Path"_ and _"Saved Tokens Path"_ to the location where the respective files are located.

## Want to Contribute?

You are more than welcome to contribute to all kinds of contributions:

* 🤔 Request/Suggest a feature
* 🐛 Report a bug
* 📖 Make this documentation better
* 💻 Contribute with the code

Before you start, we highly recommend you check the Google Assistant Unofficial Desktop Client's [contributing guidelines](./CONTRIBUTING.md).

## Default Keyboard Shortcut

* **Windows:** Win + Shift + A
* **MacOS:** Cmd + Shift + A
* **Linux:** Super + Shift + A

**Note:** Keyboard shortcut is configurable in the settings

## Other Libraries Used

* **p5.js:**
  * For visualization purpose when the user speaks through mic.
  * Link: https://p5js.org/

* **aud_player.js:**
  * For playing audio through speakers.
  * Link: https://github.com/ItsWendell/google-assistant-desktop-client/blob/develop/src/renderer/providers/assistant/player.js

* **microphone.js:**
  * For recording audio using Web API.
  * Link: https://github.com/ItsWendell/google-assistant-desktop-client/blob/develop/src/renderer/providers/assistant/microphone.js

* **google-assistant:**
  * Node.js implementation of the Google Assistant SDK
  * Link: https://github.com/endoplasmic/google-assistant

* **bumblebee-hotword:**
  * A minimalist hotword / wake word for the web, based on Porcupine
  * Link: https://github.com/jaxcore/bumblebee-hotword

[downloads]: <https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/releases>
[issues]: <https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/issues>
[build]: <https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/actions/workflows/main.yml>
[license]: <https://www.apache.org/licenses/LICENSE-2.0>
[commits]: <https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/commits/master>
[top-lang]: <https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client>
[next-milestone]: <https://github.com/Melvin-Abraham/Google-Assistant-Unofficial-Desktop-Client/discussions/576>
