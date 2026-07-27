import type { ElementNode, ProjectDocument, Scene } from '@openwish/project-schema'

export type PreflightSeverity = 'error' | 'warning'

export interface PreflightIssue {
  id: string
  severity: PreflightSeverity
  message: string
  sceneId: string
  sceneName: string
  elementId?: string
}

function issue(
  severity: PreflightSeverity,
  message: string,
  scene: Scene,
  element?: ElementNode,
): PreflightIssue {
  return {
    id: `${scene.id}:${element?.id ?? 'scene'}:${message}`,
    severity,
    message,
    sceneId: scene.id,
    sceneName: scene.name,
    elementId: element?.id,
  }
}

export function runPublishPreflight(document: ProjectDocument): PreflightIssue[] {
  const issues: PreflightIssue[] = []

  for (const scene of document.scenes) {
    if (scene.elements.length === 0) {
      issues.push(issue('warning', 'Scene masih kosong.', scene))
    }

    for (const element of scene.elements) {
      if (element.visible === false) continue

      if (
        element.x < 0 ||
        element.y < 0 ||
        element.x + element.width > scene.baseWidth ||
        element.y + element.height > scene.baseHeight
      ) {
        issues.push(issue('warning', 'Sebagian elemen berada di luar kanvas.', scene, element))
      }

      if (element.type === 'text' && element.props.content.trim().length === 0) {
        issues.push(issue('warning', 'Elemen teks masih kosong.', scene, element))
      }

      if (
        element.type === 'image' &&
        !element.props.decorative &&
        element.props.alt.trim().length === 0
      ) {
        issues.push(
          issue('error', 'Gambar non-dekoratif memerlukan teks alternatif.', scene, element),
        )
      }

      if (element.type === 'button' && !element.props.url) {
        issues.push(issue('warning', 'Tombol belum memiliki URL tujuan.', scene, element))
      }

      if (element.type === 'location' && !element.props.directionsUrl) {
        issues.push(issue('warning', 'Lokasi belum memiliki tautan petunjuk arah.', scene, element))
      }

      if (element.type === 'countdown' && new Date(element.props.target).getTime() <= Date.now()) {
        issues.push(issue('warning', 'Target hitung mundur sudah terlewati.', scene, element))
      }

      if (
        element.type === 'saveDate' &&
        element.props.endAt &&
        new Date(element.props.endAt).getTime() <= new Date(element.props.startAt).getTime()
      ) {
        issues.push(
          issue('error', 'Waktu selesai kalender harus setelah waktu mulai.', scene, element),
        )
      }
    }
  }

  return issues
}
