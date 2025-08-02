# 🧭 Health Compass

An Electron application with React + Vite.

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ npm install
```

### Development

```bash
$ npm run dev
```

### Build

```bash
# For windows
$ npm run build:win

# For macOS
$ npm run build:mac

# For Linux
$ npm run build:linux
```

## Prerequisites

For text extraction from PDF files, Health Compass requires the `pdftotext` command-line tool, which is a part of the `poppler-utils` package. This tool is necessary for extracting text from PDF files.

Follow the instructions below for your specific operating system:

**macOS**

You can install it using Homebrew:

```
brew install poppler
```

**Ubuntu / Debian**

You can install it using `apt`:

```
sudo apt-get update
sudo apt-get install poppler-utils
```

**Windows**

You will need to download and install a binary distribution of `Poppler`.

1. Go to the [Poppler for Windows website](https://www.google.com/search?q=http://blog.alivate.com.au/poppler-windows/) and download the latest version.
2. Unzip the downloaded file.
3. Add the `bin/` directory from the unzipped folder to your system's `PATH` environment variable. This allows the `pdftotext` command to be found from your terminal.

To verify that `pdftotext` is properly installed, open an terminal and enter `pdftotext`. You should see a help menu and other descriptions, something like this:

```
pdftotext
pdftotext version 20.10.0
Copyright 2005-2020 The Poppler Developers - http://poppler.freedesktop.org
Copyright 1996-2011 Glyph & Cog, LLC
Usage: pdftotext [options] <PDF-file> [<text-file>]
```
