// Web-Modules
import { Maid } from "@Universal/Modules/Maid.ts"

// Spices
import { SongLyrics } from "@Spices/Spicetify/Services/Player/mod.ts"
import { ShowNotification } from "@Spices/Spicetify/Services/Session.ts"

// Lyric Views
import { WriteTextToClipboard, CopyLyricsToClipboard } from "../LyricViews/Shared.ts"

export const LYRICS_CONTAINER_SELECTOR = [
	".LyricsScrollContainer",
	".Lyrics",
	".BeautifulLyricsPage",
	"#BeautifulLyrics-CardView",
	".lyrics-lyrics-container",
	".lyrics-lyrics-contentContainer",
	".main-nowPlayingView-lyricsContent"
].join(", ")

const getElementText = (el: HTMLElement): string => {
	if (el.innerText && el.innerText.trim().length > 0) return el.innerText.trim()
	if (el.textContent && el.textContent.trim().length > 0) return el.textContent.trim()
	if (el.children && el.children.length > 0) {
		return Array.from(el.children).map(c => getElementText(c as HTMLElement)).join("").trim()
	}
	return ""
}

/**
 * Extracts formatted text from a single VocalsGroup element.
 * If range is provided and partially intersects, only matching words are included.
 */
export const extractTextFromVocalGroup = (group: HTMLElement, range?: Range): string => {
	const lead = group.querySelector<HTMLElement>(".Vocals.Lead")
	if (!lead) return getElementText(group)

	// Check if this is a syllable-synced vocal line
	const hasSyllables = lead.querySelector(".Lyric.Syllable") !== null
	if (hasSyllables) {
		const words: string[] = []
		for (const child of Array.from(lead.children)) {
			if (range && !range.collapsed) {
				try {
					if (!range.intersectsNode(child)) continue
				} catch (_) {}
			}
			if (child.classList.contains("Word") || child.classList.contains("Lyric")) {
				const wordText = getElementText(child as HTMLElement)
				if (wordText) words.push(wordText)
			}
		}

		let lineText = words.join(" ")

		// Check for background vocals in group
		const background = group.querySelector<HTMLElement>(".Vocals.Background")
		if (background) {
			const bgWords: string[] = []
			for (const child of Array.from(background.children)) {
				if (range && !range.collapsed) {
					try {
						if (!range.intersectsNode(child)) continue
					} catch (_) {}
				}
				if (child.classList.contains("Word") || child.classList.contains("Lyric")) {
					const wordText = getElementText(child as HTMLElement)
					if (wordText) bgWords.push(wordText)
				}
			}
			if (bgWords.length > 0) {
				lineText = lineText ? `${lineText} (${bgWords.join(" ")})` : `(${bgWords.join(" ")})`
			}
		}

		return lineText.trim()
	}

	// For LineSynced or Static
	const lyricSpan = lead.querySelector<HTMLElement>(".Lyric")
	if (lyricSpan) {
		return getElementText(lyricSpan)
	}

	return getElementText(lead)
}

/**
 * Extracts lyrics text across a DOM Range, preserving line breaks and word boundaries.
 */
export const extractLyricsFromRange = (range: Range, container: Element): string => {
	// 1. Beautiful Lyrics .VocalsGroup
	const vocalGroups = Array.from(container.querySelectorAll<HTMLElement>(".VocalsGroup"))
	if (vocalGroups.length > 0) {
		const intersectingGroups = vocalGroups.filter(g => {
			try {
				return range.intersectsNode(g)
			} catch (_) {
				return false
			}
		})

		if (intersectingGroups.length > 0) {
			if (intersectingGroups.length === 1) {
				const group = intersectingGroups[0]
				const hasSyllables = group.querySelector(".Lyric.Syllable") !== null
				if (hasSyllables) {
					const lineText = extractTextFromVocalGroup(group, range)
					if (lineText.length > 0) return lineText
				}
				const raw = range.toString().trim()
				if (raw.length > 0) return raw
				return extractTextFromVocalGroup(group)
			}

			const lines: string[] = []
			for (const group of intersectingGroups) {
				const line = extractTextFromVocalGroup(group)
				if (line.length > 0) {
					lines.push(line)
				}
			}
			if (lines.length > 0) {
				return lines.join("\n").replace(/\n{3,}/g, "\n\n")
			}
		}
	}

	// 2. Spotify native lyrics: .lyrics-lyricsContent-lyric
	const nativeLyrics = Array.from(container.querySelectorAll<HTMLElement>(".lyrics-lyricsContent-lyric"))
	if (nativeLyrics.length > 0) {
		const intersecting = nativeLyrics.filter(l => {
			try {
				return range.intersectsNode(l)
			} catch (_) {
				return false
			}
		})
		if (intersecting.length > 0) {
			return intersecting.map(l => l.innerText?.trim() || l.textContent?.trim() || "").filter(Boolean).join("\n")
		}
	}

	// 3. Fallback to range text
	return range.toString().trim()
}

/**
 * Gets valid selection text and range if selection is inside a lyrics container.
 */
export const getSelectedLyricsInfo = (): { text: string; range: Range } | null => {
	if (typeof window === "undefined") return null
	const selection = window.getSelection()
	if (!selection || selection.rangeCount < 1 || selection.isCollapsed) return null

	const range = selection.getRangeAt(0)
	const commonAncestor = range.commonAncestorContainer
	const commonAncestorElement = commonAncestor instanceof HTMLElement ? commonAncestor : commonAncestor.parentElement
	if (!commonAncestorElement) return null

	const matchedContainer = commonAncestorElement.closest(LYRICS_CONTAINER_SELECTOR)
	if (!matchedContainer) return null

	const formattedText = extractLyricsFromRange(range, matchedContainer)
	if (!formattedText || formattedText.trim().length === 0) return null

	return { text: formattedText.trim(), range }
}

const lerp = (a: number, b: number, progress: number) => a * (1 - progress) + b * progress

/**
 * Initializes line selection by mouse dragging (matching the Copy Lyrics extension experience).
 */
export const SetupCopyLyricsSelection = (maid: Maid) => {
	if (typeof document === "undefined" || typeof window === "undefined") return

	// Dynamic highlight stylesheet for deselection animation (CSS Custom Highlight API)
	let injectedHighlightRule: CSSStyleRule | undefined
	let selectionAnimationIndex = 0

	const setupHighlightStyle = () => {
		if (injectedHighlightRule || typeof document === "undefined") return
		try {
			const styleEl = document.createElement("style")
			styleEl.id = "copy-lyrics-highlight-style"
			styleEl.innerHTML = "::highlight(copy-lyrics-deselection-highlight) { background-color: rgba(255, 255, 0, 0.7); color: inherit; }"
			document.head.appendChild(styleEl)
			maid.Give(() => styleEl.remove())
			injectedHighlightRule = (styleEl.sheet as CSSStyleSheet)?.cssRules?.[0] as CSSStyleRule
		} catch (e) {
			console.warn("Could not inject highlight style rule", e)
		}
	}

	const playHighlightAnimation = (range: Range) => {
		if (typeof (globalThis as any).Highlight === "undefined" || typeof CSS === "undefined" || !("highlights" in CSS)) {
			return
		}
		setupHighlightStyle()
		try {
			const highlight = new (globalThis as any).Highlight(range)
			;(CSS as any).highlights.set("copy-lyrics-deselection-highlight", highlight)

			const startColor = [255, 255, 0, 0.7]
			const endColor = [255, 255, 255, 0]
			const start = performance.now()
			const duration = 500
			selectionAnimationIndex++
			const thisAnimationIndex = selectionAnimationIndex

			const update = () => {
				if (thisAnimationIndex !== selectionAnimationIndex) return
				const progress = (performance.now() - start) / duration
				if (progress >= 1) {
					if (injectedHighlightRule) injectedHighlightRule.style.backgroundColor = "transparent"
					try {
						(CSS as any).highlights.delete("copy-lyrics-deselection-highlight")
					} catch (_) {}
				} else {
					const color = startColor.map((c, i) => lerp(c, endColor[i], progress))
					if (injectedHighlightRule) {
						injectedHighlightRule.style.backgroundColor = `rgba(${color.join(", ")})`
					}
					requestAnimationFrame(update)
				}
			}
			requestAnimationFrame(update)
		} catch (e) {
			console.warn("Failed to play highlight animation", e)
		}
	}

	let isSelecting = false
	let hasBegunSelectionSinceLastCopy = false
	let justFinishedDragSelection = false

	const stopPropagation = (event: Event) => {
		if (isSelecting || justFinishedDragSelection) {
			event.stopPropagation()
			event.preventDefault()
		}
	}

	// Capture clicks on document level to guarantee click-to-seek is never accidentally fired after dragging
	const onGlobalClickCapture = (event: MouseEvent) => {
		if (justFinishedDragSelection) {
			event.stopPropagation()
			event.preventDefault()
			justFinishedDragSelection = false
		}
	}
	document.addEventListener("click", onGlobalClickCapture, { capture: true })
	maid.Give(() => document.removeEventListener("click", onGlobalClickCapture, { capture: true }))

	// Listen for text selection changes
	const updateSelectingState = (selecting: boolean) => {
		if (selecting) {
			document.body.classList.add("copy-lyrics-selecting")
		} else {
			document.body.classList.remove("copy-lyrics-selecting")
		}

		document.querySelectorAll(LYRICS_CONTAINER_SELECTOR).forEach(lyricsContainer => {
			if (selecting) {
				lyricsContainer.classList.add("copy-lyrics-selecting")
				if (typeof CSS !== "undefined" && "highlights" in CSS) {
					try {
						(CSS as any).highlights.delete("copy-lyrics-deselection-highlight")
					} catch (_) {}
				}
				selectionAnimationIndex++
				lyricsContainer.addEventListener("click", stopPropagation, { capture: true })
			} else {
				lyricsContainer.classList.remove("copy-lyrics-selecting")
				lyricsContainer.removeEventListener("click", stopPropagation, { capture: true })
			}
		})
	}

	const onSelectionChange = () => {
		const info = getSelectedLyricsInfo()
		if (info) {
			if (isSelecting) return
			isSelecting = true
			hasBegunSelectionSinceLastCopy = true
			updateSelectingState(true)
		} else {
			if (!isSelecting) return
			isSelecting = false
			updateSelectingState(false)
		}
	}
	document.addEventListener("selectionchange", onSelectionChange)
	maid.Give(() => {
		document.removeEventListener("selectionchange", onSelectionChange)
		updateSelectingState(false)
	})

	// When mouse releases, attempt to copy the selected lyrics
	const onMouseUp = async () => {
		if (!hasBegunSelectionSinceLastCopy) return
		hasBegunSelectionSinceLastCopy = false

		const info = getSelectedLyricsInfo()
		if (!info) return

		justFinishedDragSelection = true
		globalThis.setTimeout(() => {
			justFinishedDragSelection = false
		}, 200)

		const success = await WriteTextToClipboard(info.text)
		if (success) {
			ShowNotification("Copied to clipboard!", "success", 3)
		}

		const selection = window.getSelection()
		if (selection && selection.rangeCount > 0) {
			playHighlightAnimation(info.range)
			if (typeof selection.empty === "function") {
				selection.empty()
			} else if (typeof selection.removeAllRanges === "function") {
				selection.removeAllRanges()
			}
		}
	}
	window.addEventListener("mouseup", onMouseUp)
	maid.Give(() => window.removeEventListener("mouseup", onMouseUp))

	// Copy all lyrics handler (used by Ctrl+A and context menu)
	const copyAllLyrics = async () => {
		if (SongLyrics !== undefined) {
			const success = await CopyLyricsToClipboard()
			if (success) {
				const container = document.querySelector<HTMLElement>(".Lyrics, .LyricsScrollContainer, .lyrics-lyrics-contentContainer")
				if (container) {
					const range = document.createRange()
					range.selectNodeContents(container)
					playHighlightAnimation(range)
				}
			}
			return
		}

		const selection = window.getSelection()
		const lyricsContainer = document.querySelector(LYRICS_CONTAINER_SELECTOR)
		if (!selection || !lyricsContainer) return

		if (typeof selection.empty === "function") {
			selection.empty()
		} else if (typeof selection.removeAllRanges === "function") {
			selection.removeAllRanges()
		}
		selection.selectAllChildren(lyricsContainer)
		hasBegunSelectionSinceLastCopy = true
		onMouseUp()
	}

	// Ctrl+A / Cmd+A shortcut to copy all lyrics when viewing lyrics
	const onKeyDown = (event: KeyboardEvent) => {
		if (!(event.ctrlKey || event.metaKey) || (event.key !== "a" && event.key !== "A" && event.code !== "KeyA")) return

		if (
			document.activeElement?.tagName === "INPUT" ||
			document.activeElement?.tagName === "TEXTAREA" ||
			(document.activeElement as HTMLElement)?.isContentEditable
		) {
			return
		}

		const lyricsContainer = document.querySelector(LYRICS_CONTAINER_SELECTOR)
		if (!lyricsContainer) return

		event.preventDefault()
		copyAllLyrics()
	}
	document.addEventListener("keydown", onKeyDown)
	maid.Give(() => document.removeEventListener("keydown", onKeyDown))

	// Right-click on lyrics to copy selection or all lyrics
	const onContextMenu = (event: MouseEvent) => {
		const target = event.target as HTMLElement | null
		if (!target) return

		const isLyricsElement = target.closest(".VocalsGroup, .Lyric, .Vocals, .lyrics-lyricsContent-lyric")
		if (!isLyricsElement) return

		const info = getSelectedLyricsInfo()
		if (info && info.text.length > 0) {
			event.preventDefault()
			WriteTextToClipboard(info.text).then(success => {
				if (success) ShowNotification("Copied to clipboard!", "success", 3)
			})
			playHighlightAnimation(info.range)
			window.getSelection()?.empty()
			return
		}

		event.preventDefault()
		copyAllLyrics()
	}
	document.addEventListener("contextmenu", onContextMenu)
	maid.Give(() => document.removeEventListener("contextmenu", onContextMenu))
}
