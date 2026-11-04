// Stylings
import './Stylings/main.scss'

// NPM Packages
import { bindKeyCombo, unbindKeyCombo } from "npm:@rwh/keystrokes"

// Build Spices
import { UpdateNoticeConfiguration } from "@Spices/AutoUpdate/UpdateNotice.ts"

// Spices
import {
	GlobalMaid,
	OnSpotifyReady, Spotify,
	SpotifyPlatform,
	SpotifyInternalFetch,
	SpotifyHistory,
	ShowNotification
} from "@Spices/Spicetify/Services/Session.ts"
import { GetInstantStore } from "@Spices/Spicetify/Services/Cache.ts"
import {
	Song,
	SongLyrics
} from "@Spices/Spicetify/Services/Player/mod.ts"

// Web-Modules
import { Timeout } from '@Universal/Modules/Scheduler.ts'

// Singletons
import "./DiscordVerification/mod.ts"
import "./LyricViews/mod.ts"

// Shared Methods
import {
	CreateElement,
	GetLyricsAsText,
	CopyLyricsToClipboard,
	IsLanguageRomanized
} from "./LyricViews/Shared.ts"

// Modules
import OpenUpdatePopup from "./UpdatePopup/mod.ts"
import { SetupCopyLyricsSelection } from "./Modules/CopyLyricsSelection.ts"

const Load = async () => {
	await OnSpotifyReady

	// Custom text rendering, still expirementing so not final yet
	{
		/*const canvas = GlobalMaid.Give(CreateElement<HTMLCanvasElement>("<canvas></canvas>"))
		canvas.style.backgroundColor = "rgba(255, 255, 255, 0.5)"
		canvas.style.pointerEvents = "none"
		canvas.style.width = `${document.body.clientWidth}px`
		canvas.style.height = `${document.body.clientHeight}px`
		canvas.width = document.body.clientWidth
		canvas.height = document.body.clientHeight
		canvas.style.position = "absolute"
		canvas.style.top = "0"
		canvas.style.left = "0"
		canvas.style.zIndex = "100000"
		document.body.appendChild(canvas)

		const dpr = globalThis.devicePixelRatio
		canvas.width *= dpr
		canvas.height *= dpr

		const context = canvas.getContext("2d")!
		context.scale(dpr, dpr)
		context.font = `bold 125px -apple-system, BlinkMacSystemFont, "SF Pro", "SF Pro Display", "SF Pro Text", "Helvetica Neue", Arial, sans-serif`

		context.lineWidth = 1
		context.beginPath()
		context.moveTo(100, 100)
		context.lineTo(100, 200)
		context.stroke()
		context.closePath()

		const text = "Hello World!"
		
		const bound = context.measureText(text)
		const gradient = context.createLinearGradient(100, 0, 100 + (bound.actualBoundingBoxLeft + bound.actualBoundingBoxRight), 0)
		gradient.addColorStop(0, "rgba(255, 255, 255, 1)")
		gradient.addColorStop(0.25, "rgba(255, 255, 255, 1)")
		gradient.addColorStop(0.5, "rgba(255, 255, 255, 0.75)")
		gradient.addColorStop(0.75, "rgba(255, 255, 255, 0.5)")
		gradient.addColorStop(1, "rgba(255, 255, 255, 0)")
		context.fillStyle = gradient

		context.shadowColor = "rgba(255, 255, 255, 1)"
		context.shadowBlur = 30
		context.fillText(text, 100, 180)

		const segmenter = new Intl.Segmenter("en", { granularity: "grapheme" })
		let measure_String = ""
		for(const segment of []) {//segmenter.segment(text)) {
			measure_String += segment.segment
			if (segment.segment === " ") {
				continue
			}

			const measureBounds = context.measureText(measure_String)
			context.fillStyle = `rgba(${
			Math.floor(Math.random() * 255)
			}, ${Math.floor(Math.random() * 255)}, ${
			Math.floor(Math.random() * 255)
			}, 1)`
			context.beginPath()
			context.rect(
				100 - measureBounds.actualBoundingBoxLeft,
				180,// + (50 * (measure_String.length - 1)),
				(measureBounds.actualBoundingBoxRight + measureBounds.actualBoundingBoxLeft),
				(measureBounds.actualBoundingBoxAscent + measureBounds.actualBoundingBoxDescent)
			)
			context.fill()
			context.closePath()
			console.log(measureBounds, context.measureText(segment.segment))

			const segmentBounds = context.measureText(segment.segment)
			const segmentWidth = (segmentBounds.actualBoundingBoxRight + segmentBounds.actualBoundingBoxLeft)

			context.fillStyle = `rgba(${
			Math.floor(Math.random() * 255)
			}, ${Math.floor(Math.random() * 255)}, ${
			Math.floor(Math.random() * 255)
			}, 0.5`
			context.beginPath()
			context.rect(
				(
					100 - measureBounds.actualBoundingBoxLeft
					+ (measureBounds.actualBoundingBoxRight + measureBounds.actualBoundingBoxLeft)
					- (segmentBounds.actualBoundingBoxRight + segmentBounds.actualBoundingBoxLeft)
				),
				180 - (segmentBounds.actualBoundingBoxAscent + segmentBounds.actualBoundingBoxDescent),
				segmentWidth,
				(segmentBounds.actualBoundingBoxAscent + segmentBounds.actualBoundingBoxDescent)
			)
			context.fill()
			context.closePath()

			context.fillStyle = "grey"
			context.fillText(
				segment.segment,
				(
					100 - measureBounds.actualBoundingBoxLeft
					+ (measureBounds.actualBoundingBoxRight + measureBounds.actualBoundingBoxLeft)
					- (segmentBounds.actualBoundingBoxRight + segmentBounds.actualBoundingBoxLeft)
					+ segmentBounds.actualBoundingBoxLeft
				),
				190
			)
		}*/

		/*const HBounds = context.measureText("H")
		const eBounds = context.measureText("e")
		const HeBounds = context.measureText("He")

		const HeWidth = (HeBounds.actualBoundingBoxRight + HeBounds.actualBoundingBoxLeft)
		const HWidth = (HBounds.actualBoundingBoxRight + HBounds.actualBoundingBoxLeft)
		const eWidth = (eBounds.actualBoundingBoxRight + eBounds.actualBoundingBoxLeft)

		context.fillStyle = "rgba(0, 0, 0, 0.5)"
		context.rect(
			100 - HBounds.actualBoundingBoxLeft,
			180 - HBounds.actualBoundingBoxAscent,
			HBounds.actualBoundingBoxRight + HBounds.actualBoundingBoxLeft,
			HBounds.actualBoundingBoxAscent + HBounds.actualBoundingBoxDescent
		)
		context.fill()
		context.fillStyle = "rgba(0, 0, 255, 0.5)"
		const eRelativePositionX = HeWidth - eWidth - HeBounds.actualBoundingBoxLeft
		context.rect(
			100 + eRelativePositionX,
			180 - eBounds.actualBoundingBoxAscent,
			eBounds.actualBoundingBoxRight + eBounds.actualBoundingBoxLeft,
			eBounds.actualBoundingBoxAscent + eBounds.actualBoundingBoxDescent
		)
		context.fill()

		const spaceBetweenHande = (eRelativePositionX - HWidth + HBounds.actualBoundingBoxLeft)
		context.fillStyle = "rgba(255, 0, 0, 0.5)"
		context.rect(
			100 - HBounds.actualBoundingBoxLeft + HWidth,
			180 - eBounds.actualBoundingBoxAscent,
			spaceBetweenHande,
			HBounds.actualBoundingBoxAscent + HBounds.actualBoundingBoxDescent
		)
		context.fill()

		context.fillStyle = "grey"
		context.fillText(
			"H",
			100,
			200
		)
		context.fillText(
			"e",
			100 - HBounds.actualBoundingBoxLeft + HWidth + spaceBetweenHande + eBounds.actualBoundingBoxLeft,
			200
		)*/
	}

	{ // Handle our Debugging (gives Linux an opportunity to get this information)
		const OnGetSpotifyAndSpicetifyInformation = async () => {
			try {
				let response: any
				try {
					response = await SpotifyInternalFetch.get("sp://desktop/v1/version")
				} catch (_) {
					response = {
						version: SpotifyPlatform?.version ?? "unknown",
						cefVersion: "unknown"
					}
				}
				const cfg = (Spotify as any)?.Config ?? {}
				const informationFormat = `
					Spotify Version: ${response?.version ?? SpotifyPlatform?.version ?? "unknown"}
					Spotify Runtime: ${response?.cefVersion ?? "unknown"}
					Spicetify Version: ${cfg.version ?? "unknown"}
					Spicetify Theme: ${cfg.current_theme ?? "unknown"}${
						(!cfg.color_scheme || cfg.color_scheme.length === 0) ? "" : ` / ${cfg.color_scheme}`
					}
					Spicetify Extensions: [${(cfg.extensions ?? []).join(", ")}]
					Spicetify Custom Apps: [${(cfg.custom_apps ?? []).join(", ")}]
				`.trim().replace(/\t/g, "")
				await navigator.clipboard.writeText(informationFormat)
				ShowNotification("Copied Spotify/Spicetify Information", "success", 5)
			} catch (error) {
				ShowNotification(`Failed to Copy Spotify/Spicetify Information (${error})`, "error", 10)
			}
		}
		bindKeyCombo("shift+b+l>i", OnGetSpotifyAndSpicetifyInformation)
		GlobalMaid.Give(() => unbindKeyCombo("shift+b+l>i", OnGetSpotifyAndSpicetifyInformation))
	
		// Create our reusable link element (for saving)
		const linkElement = CreateElement<HTMLLinkElement & { download: string }>(`<a></a>`)
		const SaveContentToFile = (downloadName: string, content: string, contentType: string) => {
			const jsonBlob = new Blob([content], { type: contentType })
			const url = URL.createObjectURL(jsonBlob)
			linkElement.download = downloadName
			linkElement.href = url
			linkElement.click()
			URL.revokeObjectURL(url)
		}

		// Handle file-saving
		const OnSaveSpotifyHTML = () => SaveContentToFile("Spotify.html", document.documentElement.innerHTML, "text/html")
		const OnSaveSpotifyCSS = () => (
			fetch("xpui.css")
			.then((response) => response.text())
			.then(text => SaveContentToFile("Spotify.css", text, "text/css"))
			.catch((error) => ShowNotification(`Failed to Save Spotify CSS (${error})`, "error", 10))
		)
		bindKeyCombo("shift+b+l>h", OnSaveSpotifyHTML)
		bindKeyCombo("shift+b+l>c", OnSaveSpotifyCSS)
		GlobalMaid.GiveItems(
			() => unbindKeyCombo("shift+b+l>h", OnSaveSpotifyHTML),
			() => unbindKeyCombo("shift+b+l>c", OnSaveSpotifyCSS)
		)
	}

	{ // Handle Copy Lyrics features
		// Initialize dragging mouse to select lines and copy lyrics (matching copy-lyrics extension)
		SetupCopyLyricsSelection(GlobalMaid)

		// Spicetify Context Menu Item on currently playing song
		if (Spotify?.ContextMenu?.Item) {
			const copyLyricsContextItem = new Spotify.ContextMenu.Item(
				"Copy Lyrics",
				() => {
					CopyLyricsToClipboard()
				},
				(uris) => {
					if (SongLyrics === undefined || Song === undefined) return false
					return (uris.length === 1 && uris[0] === Song.Uri)
				},
				"copy"
			)
			copyLyricsContextItem.register()
			GlobalMaid.Give(() => copyLyricsContextItem.deregister())
		}

		// Keyboard shortcut shift+b+l>l
		const OnCopyLyricsShortcut = () => {
			CopyLyricsToClipboard()
		}
		bindKeyCombo("shift+b+l>l", OnCopyLyricsShortcut)
		GlobalMaid.Give(() => unbindKeyCombo("shift+b+l>l", OnCopyLyricsShortcut))

		// Native copy event listener (Ctrl+C / Cmd+C when on Beautiful Lyrics view with no text selection)
		const OnDocumentCopy = (event: ClipboardEvent) => {
			if (
				document.activeElement?.tagName === "INPUT" ||
				document.activeElement?.tagName === "TEXTAREA" ||
				(document.activeElement as HTMLElement)?.isContentEditable
			) {
				return
			}
			const selection = window.getSelection()?.toString()
			if (selection && selection.trim().length > 0) {
				return
			}
			const isViewingLyrics =
				Boolean(SpotifyHistory?.location?.pathname?.startsWith("/BeautifulLyrics")) ||
				document.querySelector("#BeautifulLyrics-CardView, .BeautifulLyricsPage") !== null
			if (
				isViewingLyrics &&
				SongLyrics !== undefined
			) {
				const isRomanized = (SongLyrics.RomanizedLanguage !== undefined) && IsLanguageRomanized(SongLyrics.RomanizedLanguage)
				const lyricsText = GetLyricsAsText(SongLyrics, isRomanized)
				if (lyricsText && lyricsText.trim().length > 0) {
					event.preventDefault()
					event.clipboardData?.setData("text/plain", lyricsText)
					ShowNotification("Copied lyrics to clipboard", "success", 3)
				}
			}
		}
		document.addEventListener("copy", OnDocumentCopy)
		GlobalMaid.Give(() => document.removeEventListener("copy", OnDocumentCopy))
	}

	// Only opens the Update Popup IF we haven't seen it yet
	OpenUpdatePopup()
}
Load()

// Finally, return our maid and also return our UpdateNotificationDetailer
export const UpdateNotice: UpdateNoticeConfiguration = {
	Type: "Notification",
	Name: "Beautiful Lyrics"
}
export default GlobalMaid