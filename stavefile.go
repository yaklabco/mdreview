//go:build stave

package main

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/yaklabco/stave/pkg/sh"
	"github.com/yaklabco/stave/pkg/st"
)

type Build st.Namespace
type Install st.Namespace

var Default = Build.All

var Aliases = map[string]any{
	"b":  Build.All,
	"be": Build.Electron,
	"bx": Build.Ext,
	"i":  Install.All,
	"im": Install.Mac,
	"ih": Install.Host,
	"t":  Test,
	"c":  Check,
}

var bun = sh.RunCmd("bun")

// Ext builds the Chrome extension via Vite and ensures the native host is registered.
func (Build) Ext() error {
	st.Deps(Install.Host)
	return bun("run", "build:ext")
}

// Electron builds the core and electron packages via turbo.
func (Build) Electron() error {
	return bun("run", "build:electron")
}

// Host bundles the Chrome extension native messaging host via esbuild.
func (Build) Host() error {
	return bun("x", "esbuild",
		"packages/chrome-ext/src/native-host/host.ts",
		"--bundle", "--platform=node", "--format=cjs",
		"--outfile=packages/chrome-ext/src/native-host/host.cjs",
	)
}

// All builds the Chrome extension, Electron app, and native messaging host.
func (Build) All() {
	st.Deps(Build.Ext, Build.Electron, Build.Host)
}

// Mac packages and installs Design Review.app to /Applications.
func (Install) Mac() error {
	if runtime.GOOS != "darwin" {
		return fmt.Errorf("install:mac only runs on macOS")
	}
	st.Deps(Build.Electron, Build.Host)

	if err := sh.RunV("bun", "run", "--cwd", "packages/electron", "dist:mac"); err != nil {
		return fmt.Errorf("electron-builder: %w", err)
	}

	arch := "x64"
	if runtime.GOARCH == "arm64" {
		arch = "arm64"
	}
	src := filepath.Join("packages", "electron", "dist", "mac-"+arch, "Design Review.app")
	dst := filepath.Join("/Applications", "Design Review.app")

	absSrc, err := filepath.Abs(src)
	if err != nil {
		return fmt.Errorf("resolve path: %w", err)
	}

	shellCmd := fmt.Sprintf("rm -rf '%s' && cp -R '%s' '%s'", dst, absSrc, dst)
	return sh.RunV("osascript", "-e",
		fmt.Sprintf(`do shell script "%s" with administrator privileges`, shellCmd),
	)
}

// Host registers the native messaging host with Chrome.
func (Install) Host() error {
	st.Deps(Build.Host)
	extID := os.Getenv("EXTENSION_ID")
	if extID == "" {
		extID = "ffcdomegaapbonccgihgcbpfdnenaocp"
	}
	return sh.RunV("bash", "packages/chrome-ext/src/native-host/install.sh", extID)
}

// All builds everything and installs the Mac app and native messaging host.
func (Install) All() {
	st.Deps(Build.All, Install.Mac, Install.Host)
}

// Dev starts the Chrome extension dev server.
func Dev() error {
	return bun("run", "dev")
}

// DevElectron starts the Electron dev server.
func DevElectron() error {
	return bun("run", "dev:electron")
}

// Test runs all tests in single-run mode.
func Test() error {
	return bun("run", "test:ci")
}

// Check runs lint and tests.
func Check() error {
	return bun("run", "check")
}

// Clean removes build artifacts.
func Clean() error {
	return bun("run", "clean")
}
