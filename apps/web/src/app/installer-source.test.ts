import { describe, expect, it } from 'vitest'
import { installerFromGithubRelease, installerFromManifest } from './installer-source'

const release = {
  tag_name: 'v0.2.0',
  draft: false,
  assets: [
    {
      name: 'Hydras_0.2.0_x64_en-US.msi',
      size: 10,
      browser_download_url:
        'https://github.com/Arjun-Walia/Hydras/releases/download/v0.2.0/Hydras_0.2.0_x64_en-US.msi',
    },
    {
      name: 'Hydras_0.2.0_x64-setup.exe',
      size: 60_622_664,
      digest: `sha256:${'ab'.repeat(32)}`,
      browser_download_url:
        'https://github.com/Arjun-Walia/Hydras/releases/download/v0.2.0/Hydras_0.2.0_x64-setup.exe',
    },
  ],
}

describe('installer from the latest GitHub release', () => {
  it('picks the x64 setup exe with its size, version and checksum', () => {
    expect(installerFromGithubRelease(release)).toEqual({
      url: 'https://github.com/Arjun-Walia/Hydras/releases/download/v0.2.0/Hydras_0.2.0_x64-setup.exe',
      fileName: 'Hydras_0.2.0_x64-setup.exe',
      bytes: 60_622_664,
      version: '0.2.0',
      sha256: 'ab'.repeat(32),
    })
  })

  it('ignores drafts, missing installers and download URLs outside this repo', () => {
    expect(installerFromGithubRelease({ ...release, draft: true })).toBeNull()
    expect(installerFromGithubRelease({ ...release, assets: [release.assets[0]] })).toBeNull()
    const foreign = {
      ...release,
      assets: [{ ...release.assets[1], browser_download_url: 'https://evil.example/setup.exe' }],
    }
    expect(installerFromGithubRelease(foreign)).toBeNull()
    expect(installerFromGithubRelease({ message: 'API rate limit exceeded' })).toBeNull()
    expect(installerFromGithubRelease(null)).toBeNull()
  })
})

describe('installer from a staged manifest', () => {
  it('links the staged setup exe on this site', () => {
    const manifest = {
      version: '0.2.0',
      builtAt: '2026-11-21T00:00:00Z',
      assets: [{ kind: 'nsis', file: 'Hydras_0.2.0_x64-setup.exe', bytes: 5, sha256: 'x' }],
    }
    expect(installerFromManifest(manifest)).toMatchObject({
      url: '/downloads/Hydras_0.2.0_x64-setup.exe',
      version: '0.2.0',
    })
    expect(installerFromManifest({ version: '1' })).toBeNull()
  })
})
