// External Lyric Provider Functions

// Lyrics Types
import type { LineVocal, Lyrics as ProviderLyrics, SyllableMetadata, SyllableVocalSet } from "@Universal/Types/Lyrics.ts"

// Diacritic stripping for romanization
import { stripDiacritics } from "./LyricUtilities.ts"

// Spicetify Services (for Spotify native API and access token)
import { SpotifyRequestBuilder, SpotifyInternalFetch, SpotifyFetch, SpotifyPlatform, GetSpotifyAccessToken, SpotifyPlayer } from "../Session.ts"

// Helper type for LRC timestamp parsing
type LrcLine = { time: number; text: string }

const parseLrcTimestamp = (timestamp: string): number | undefined => {
	const match = /^(?:(\d{1,2}):)?(\d{1,3}):(\d{2})(?:[.,](\d{1,4}))?$/.exec(timestamp.trim())
	if (match === null) return undefined
	const hours = match[1] !== undefined ? Number(match[1]) : 0
	const minutes = Number(match[2])
	const seconds = Number(match[3])
	const fractionStr = (match[4] ?? "0").padEnd(3, "0").slice(0, 3)
	const ms = Number(fractionStr)
	return hours * 3600 + minutes * 60 + seconds + ms / 1000
}

const convertLrcToLineLyrics = (lrc: string | undefined | null, durationSeconds?: number): ProviderLyrics | undefined => {
	if (lrc === undefined || lrc === null) return undefined

	const parsedLines: LrcLine[] = []
	const timestampPattern = /\[((?:\d{1,2}:)?\d{1,3}:\d{2}(?:[.,]\d{1,4})?)\]/g

	for (const rawLine of lrc.split(/\r?\n/)) {
		const timestamps = [...rawLine.matchAll(timestampPattern)]
		if (timestamps.length === 0) continue
		const text = rawLine.replace(timestampPattern, "").trim()
		if (text.length === 0) continue
		for (const ts of timestamps) {
			const time = parseLrcTimestamp(ts[1]!)
			if (time !== undefined) parsedLines.push({ time, text })
		}
	}

	parsedLines.sort((a, b) => a.time - b.time)
	if (parsedLines.length === 0) return undefined

	const content: LineVocal[] = parsedLines.map((line, index) => {
		const nextLine = parsedLines[index + 1]
		const fallbackEndTime = Math.max(line.time + 3, durationSeconds ?? (line.time + 5))
		const rawEndTime = (nextLine?.time !== undefined && nextLine.time > line.time) ? nextLine.time : fallbackEndTime
		return {
			Type: "Vocal",
			Text: line.text,
			StartTime: line.time,
			EndTime: Math.max(line.time + 0.3, rawEndTime),
			OppositeAligned: false
		}
	})

	return {
		Type: "Line",
		StartTime: content[0].StartTime,
		EndTime: content[content.length - 1].EndTime,
		Content: content
	}
}

const convertPlainTextToStatic = (text: string | undefined | null): ProviderLyrics | undefined => {
	if (text === undefined || text === null) return undefined
	const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0).map(l => ({ Text: l }))
	if (lines.length === 0) return undefined
	return { Type: "Static", Lines: lines }
}

const parseTtmlTime = (value: string | undefined): number | undefined => {
	if (value === undefined || value.length === 0) return undefined

	const clockMatch = /^(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.(\d{1,3}))?$/.exec(value)
	if (clockMatch !== null) {
		const h = Number(clockMatch[1]); const m = Number(clockMatch[2])
		const s = clockMatch[3] === undefined ? undefined : Number(clockMatch[3])
		const ms = Number((clockMatch[4] ?? "0").padEnd(3, "0"))
		return s === undefined ? (h * 60 + m + ms / 1000) : (h * 3600 + m * 60 + s + ms / 1000)
	}

	const plainSecs = /^(\d+(?:\.\d+)?)(?:s)?$/.exec(value)
	if (plainSecs?.[1] !== undefined) return Number(plainSecs[1])
	return undefined
}

const convertTtmlToSyllableLyrics = (ttml: string | undefined | null): ProviderLyrics | undefined => {
	if (ttml === undefined || ttml === null || ttml.trim().length === 0) return undefined

	const spanPattern = /<span\b([^>]*)>([\s\S]*?)<\/span>/gi
	const attrPattern = /\b([A-Za-z_:][\w:.-]*)\s*=\s*"([^"]*)"/g
	const tagPattern = /<[^>]+>/g

	const decodeXml = (v: string) => v.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&")

	const pElements = ttml.match(/<p\b[^>]*>[\s\S]*?<\/p>/gi)
	if (pElements === null || pElements.length === 0) return undefined

	const content: SyllableVocalSet[] = []
	for (const pEl of pElements) {
		const spanMatches = [...pEl.matchAll(spanPattern)]
		type ParsedSpan = { text: string; attrs: Map<string, string> }
		const parsed: ParsedSpan[] = []
		for (const match of spanMatches) {
			const rawAttrs = match[1]; const rawText = match[2]
			if (rawAttrs === undefined || rawText === undefined) continue
			const text = decodeXml(rawText.replace(tagPattern, "")).trim()
			if (text.length === 0) continue
			const attrs = new Map<string, string>()
			for (const a of rawAttrs.matchAll(attrPattern)) {
				if (a[1] !== undefined && a[2] !== undefined) attrs.set(a[1], decodeXml(a[2]))
			}
			parsed.push({ text, attrs })
		}

		// Pair x-roman spans with their preceding primary span
		const primarySpans: Array<{ text: string; attrs: Map<string, string>; romanText?: string }> = []
		for (let i = 0; i < parsed.length; i++) {
			const span = parsed[i]
			const role = span.attrs.get("ttm:role")
			if (role === "x-bg" || role === "x-translation") continue
			if (role === "x-roman") {
				// Attach to the last primary span
				const last = primarySpans[primarySpans.length - 1]
				if (last !== undefined) last.romanText = stripDiacritics(span.text)
				continue
			}
			const sTime = parseTtmlTime(span.attrs.get("begin"))
			const eTime = parseTtmlTime(span.attrs.get("end"))
			if (sTime === undefined || eTime === undefined || eTime <= sTime) continue
			primarySpans.push({ text: span.text, attrs: span.attrs })
			// Check if next parsed span is x-roman at same position
			if (i + 1 < parsed.length && parsed[i + 1].attrs.get("ttm:role") === "x-roman") {
				const nextText = parsed[i + 1].text
				if (nextText.length > 0) primarySpans[primarySpans.length - 1].romanText = stripDiacritics(nextText)
				i++ // skip the x-roman span
			}
		}

		if (primarySpans.length === 0) continue
		const syllables: SyllableMetadata[] = []
		for (const span of primarySpans) {
			const sTime = parseTtmlTime(span.attrs.get("begin"))
			const eTime = parseTtmlTime(span.attrs.get("end"))
			if (sTime === undefined || eTime === undefined || eTime <= sTime) continue
			const syl: SyllableMetadata = { Text: span.text, StartTime: sTime, EndTime: eTime, IsPartOfWord: false }
			if (span.romanText !== undefined) syl.RomanizedText = stripDiacritics(span.romanText)
			syllables.push(syl)
		}

		if (syllables.length === 0) continue
		const first = syllables[0]; const last = syllables[syllables.length - 1]
		if (first === undefined || last === undefined) continue

		content.push({
			Type: "Vocal",
			OppositeAligned: false,
			Lead: { StartTime: first.StartTime, EndTime: last.EndTime, Syllables: syllables }
		})
	}

	if (content.length === 0) return undefined
	return {
		Type: "Syllable",
		StartTime: content[0].Lead.StartTime,
		EndTime: content[content.length - 1].Lead.EndTime,
		Content: content
	}
}

// Provider: LRCLIB search (supports CORS: access-control-allow-origin: *)
export const FetchLRCLIBLyrics = (artist: string, title: string, duration?: number): Promise<ProviderLyrics | undefined> => {
	const params = new URLSearchParams({ artist_name: artist, track_name: title })
	if (duration !== undefined) params.set("duration", String(Math.round(duration)))
	return (
		fetch(`https://lrclib.net/api/search?${params.toString()}`, { headers: { "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			if (Array.isArray(data) === false || data.length === 0) return undefined
			// Prioritize any result that actually has synced lyrics
			const synced = data.find((item: any) => item.instrumental !== true && typeof item.syncedLyrics === "string" && item.syncedLyrics.trim().length > 0)
			if (synced !== undefined) {
				const converted = convertLrcToLineLyrics(synced.syncedLyrics, duration ?? synced.duration)
				if (converted !== undefined) return converted
			}
			// Fallback to plain lyrics if no synced lyrics exist
			const plain = data.find((item: any) => item.instrumental !== true && typeof item.plainLyrics === "string" && item.plainLyrics.trim().length > 0)
			if (plain !== undefined) {
				return convertPlainTextToStatic(plain.plainLyrics)
			}
			return undefined
		})
		.catch(() => undefined)
	)
}

// Provider: LRCLIB lookup by ISRC (supports CORS)
export const FetchLRCLIBByISRC = (isrc: string): Promise<ProviderLyrics | undefined> => {
	return (
		fetch(`https://lrclib.net/api/get?isrc=${encodeURIComponent(isrc)}`, { headers: { "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((result: any) => {
			if (result === undefined || result === null) return undefined
			if (result.instrumental === true) return undefined
			if (typeof result.syncedLyrics === "string" && result.syncedLyrics.trim().length > 0) {
				const converted = convertLrcToLineLyrics(result.syncedLyrics, result.duration)
				if (converted !== undefined) return converted
			}
			if (typeof result.plainLyrics === "string" && result.plainLyrics.trim().length > 0) {
				return convertPlainTextToStatic(result.plainLyrics)
			}
			return undefined
		})
		.catch(() => undefined)
	)
}

// Provider: Spotify color-lyrics via internal RequestBuilder or CosmosAsync/Fetch fallback
export const FetchDirectSpotifyLyrics = (songId: string, internalId: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://spclient.wg.spotify.com/color-lyrics/v2/track/${internalId}?format=json&vocalRemoval=false&market=from_token`
	let fetchPromise: Promise<any>
	if (SpotifyRequestBuilder !== undefined) {
		const builder = (
			SpotifyRequestBuilder.build()
			.withHost("https://spclient.wg.spotify.com/color-lyrics/v2")
			.withPath(`/track/${internalId}?format=json&vocalRemoval=false&market=from_token`)
		)
		fetchPromise = (builder.send() as Promise<any>).then(r => r?.ok === false ? undefined : (r?.body ?? r))
	} else if (SpotifyInternalFetch !== undefined) {
		fetchPromise = SpotifyInternalFetch.get(url).catch(() => undefined)
	} else {
		fetchPromise = SpotifyFetch(url).then(r => r.ok ? r.json() : undefined).catch(() => undefined)
	}

	return (
		fetchPromise
		.then((response): ProviderLyrics | undefined => {
			if (response === undefined || response?.ok === false) return undefined
			const lyrics = response?.lyrics ?? response?.body?.lyrics
			if (lyrics === undefined) return undefined

			const lines = lyrics.lines
			if (Array.isArray(lines) === false || lines.length === 0) return undefined

			if (lyrics.syncType === "LINE_SYNCED") {
				const content: LineVocal[] = []
				for (let i = 0; i < lines.length; i++) {
					const line = lines[i]
					const sTime = parseInt(line.startTimeMs) / 1000
					if (isNaN(sTime)) continue

					// Spotify color-lyrics sets endTimeMs to "0"; calculate end time from next line or duration
					const nextLineTime = (i + 1 < lines.length) ? (parseInt(lines[i + 1].startTimeMs) / 1000) : undefined
					const rawEndTime = parseInt(line.endTimeMs) / 1000
					const eTime = (!isNaN(rawEndTime) && rawEndTime > sTime)
						? rawEndTime
						: (nextLineTime !== undefined && !isNaN(nextLineTime) && nextLineTime > sTime)
							? nextLineTime
							: (sTime + 5)

					content.push({
						Type: "Vocal",
						StartTime: sTime,
						EndTime: Math.max(sTime + 0.3, eTime),
						Text: line.words || "",
						OppositeAligned: false
					})
				}
				if (content.length === 0) return undefined
				return {
					Type: "Line",
					StartTime: content[0].StartTime,
					EndTime: content[content.length - 1].EndTime,
					Content: content
				}
			}

			if (lyrics.syncType === "UNSYNCED") {
				const staticLines = lines
					.filter((l: any) => typeof l.words === "string")
					.map((l: any) => ({ Text: l.words }))
				if (staticLines.length === 0) return undefined
				return { Type: "Static", Lines: staticLines }
			}

			return undefined
		})
		.catch(() => undefined)
	)
}

// Provider: Lyrics.ovh static lyrics (supports CORS: access-control-allow-origin: *)
export const FetchLyricsOvh = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
	return (
		fetch(url, { headers: { "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined || data?.error) return undefined
			if (typeof data.lyrics === "string" && data.lyrics.length > 0) {
				return convertPlainTextToStatic(data.lyrics)
			}
			return undefined
		})
		.catch(() => undefined)
	)
}

// Provider: BetterLyrics Unison - syllable (TTML) / line (LRC) via unison.boidu.dev (supports CORS)
const fetchUnisonByFormat = (artist: string, title: string, targetFormat: "ttml" | "lrc"): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	const searchUrl = `https://unison.boidu.dev/lyrics/search?q=${encodeURIComponent(query)}`

	return (
		fetch(searchUrl, { headers: { "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((searchData: any) => {
			if (searchData?.success !== true || Array.isArray(searchData?.data) === false) return undefined

			const candidates = searchData.data
				.filter((r: any) => r.format === targetFormat && typeof r.id === "number")
				.sort((a: any, b: any) => (b.matchScore ?? 0) - (a.matchScore ?? 0))

			if (candidates.length === 0) return undefined
			return candidates[0].id as number
		})
		.then((id: number | undefined) => {
			if (id === undefined) return undefined
			return fetch(`https://unison.boidu.dev/lyrics/${id}`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.json())
		.then((lyricsData: any) => {
			if (lyricsData?.success !== true) return undefined
			const lyrics: unknown = lyricsData?.data?.lyrics
			if (typeof lyrics !== "string" || lyrics.length === 0) return undefined

			if (targetFormat === "ttml") return convertTtmlToSyllableLyrics(lyrics)
			return convertLrcToLineLyrics(lyrics) ?? convertPlainTextToStatic(lyrics)
		})
		.catch(() => undefined)
	)
}

export const FetchBetterLyricsUnison = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	return fetchUnisonByFormat(artist, title, "ttml")
}

export const FetchBetterLyricsUnisonLine = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	return fetchUnisonByFormat(artist, title, "lrc")
}

// Provider: BiniLyrics (syllable/line) via LyricsPlus API (supports CORS: access-control-allow-origin: *)
const convertLyricsPlusToSyllable = (data: any): ProviderLyrics | undefined => {
	if (data?.type !== "Word" || Array.isArray(data?.lyrics) === false || data.lyrics.length === 0) return undefined
	const content: SyllableVocalSet[] = []
	for (const line of data.lyrics) {
		if (Array.isArray(line?.syllabus) === false || line.syllabus.length === 0) continue
		const syllables: SyllableMetadata[] = []
		for (let i = 0; i < line.syllabus.length; i++) {
			const w = line.syllabus[i]
			if (typeof w.text !== "string" || typeof w.time !== "number") continue
			const sTime = w.time / 1000
			const nextW = line.syllabus[i + 1]
			const nextTime = typeof nextW?.time === "number" ? nextW.time / 1000 : undefined
			const rawDur = typeof w.duration === "number" ? w.duration / 1000 : undefined
			const eTime = (rawDur !== undefined && rawDur > 0)
				? sTime + rawDur
				: (nextTime !== undefined && nextTime > sTime)
					? nextTime
					: sTime + 0.5

			const hasTrailingSpace = w.text.endsWith(" ")
			syllables.push({
				Text: w.text.trim(),
				StartTime: sTime,
				EndTime: Math.max(sTime + 0.05, eTime),
				IsPartOfWord: !hasTrailingSpace && (i + 1 < line.syllabus.length)
			})
		}
		if (syllables.length === 0) continue
		const first = syllables[0]; const last = syllables[syllables.length - 1]
		if (first === undefined || last === undefined) continue
		content.push({
			Type: "Vocal",
			OppositeAligned: false,
			Lead: { StartTime: first.StartTime, EndTime: last.EndTime, Syllables: syllables }
		})
	}
	if (content.length === 0) return undefined
	return { Type: "Syllable", StartTime: content[0].Lead.StartTime, EndTime: content[content.length - 1].Lead.EndTime, Content: content }
}

const convertLyricsPlusToLine = (data: any): ProviderLyrics | undefined => {
	if ((data?.type !== "Word" && data?.type !== "Line") || Array.isArray(data?.lyrics) === false || data.lyrics.length === 0) return undefined
	const content: LineVocal[] = []
	for (let i = 0; i < data.lyrics.length; i++) {
		const line = data.lyrics[i]
		if (typeof line.text !== "string" || typeof line.time !== "number") continue
		const sTime = line.time / 1000
		const nextLine = data.lyrics[i + 1]
		const nextTime = typeof nextLine?.time === "number" ? nextLine.time / 1000 : undefined
		const rawDuration = typeof line.duration === "number" ? line.duration / 1000 : undefined
		const eTime = (rawDuration !== undefined && rawDuration > 0)
			? sTime + rawDuration
			: (nextTime !== undefined && nextTime > sTime)
				? nextTime
				: sTime + 5

		content.push({
			Type: "Vocal",
			Text: line.text,
			StartTime: sTime,
			EndTime: Math.max(sTime + 0.3, eTime),
			OppositeAligned: false
		})
	}
	if (content.length === 0) return undefined
	return { Type: "Line", StartTime: content[0].StartTime, EndTime: content[content.length - 1].EndTime, Content: content }
}

export const FetchBiniLyricsLine = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://lyricsplus.binimum.org/v2/lyrics/get?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
	return (
		fetch(url, { headers: { "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then(data => convertLyricsPlusToLine(data))
		.catch(() => undefined)
	)
}

export const FetchBiniLyrics = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://lyricsplus.binimum.org/v2/lyrics/get?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}`
	return (
		fetch(url, { headers: { "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then(data => convertLyricsPlusToSyllable(data))
		.catch(() => undefined)
	)
}

// Provider: Musixmatch (Richsync syllable, Subtitles line, and static lyrics) via official mobile API
let cachedMusixmatchToken: string | undefined

export const GetMusixmatchToken = async (): Promise<string | undefined> => {
	if (cachedMusixmatchToken !== undefined && cachedMusixmatchToken.length > 0) {
		return cachedMusixmatchToken
	}

	const tokenUrl = "https://apic-appmobile.musixmatch.com/ws/1.1/token.get?app_id=mac-ios-v2.0"
	const headers = {
		Accept: "application/json",
		"User-Agent": "Musixmatch/2025120901 CFNetwork/3860.300.31 Darwin/25.2.0"
	}

	try {
		const res = await fetch(tokenUrl, { headers })
		if (res.ok) {
			const data = await res.json()
			const token = data?.message?.body?.user_token
			if (typeof token === "string" && token.length > 0 && token !== "00000000000000000000000000000000000000000000000000000000") {
				cachedMusixmatchToken = token
				return token
			}
		}
	} catch {}

	return undefined
}

const convertMusixmatchRichsyncToSyllable = (richsyncBody: string | any[]): ProviderLyrics | undefined => {
	let lines: any[]
	if (typeof richsyncBody === "string") {
		try { lines = JSON.parse(richsyncBody) } catch { return undefined }
	} else if (Array.isArray(richsyncBody)) {
		lines = richsyncBody
	} else {
		return undefined
	}
	if (!Array.isArray(lines) || lines.length === 0) return undefined

	const content: SyllableVocalSet[] = []
	for (const line of lines) {
		const ts = Number(line?.ts)
		const te = Number(line?.te)
		if (isNaN(ts) || isNaN(te) || te <= ts) continue
		const tokens = line?.l
		if (!Array.isArray(tokens) || tokens.length === 0) continue

		const syllables: SyllableMetadata[] = []
		for (let i = 0; i < tokens.length; i++) {
			const tok = tokens[i]
			const text = tok?.c
			if (typeof text !== "string" || text.trim().length === 0) continue
			const offset = Number(tok?.o ?? 0)
			const sTime = ts + offset

			let eTime = te
			let isPartOfWord = false
			if (i + 1 < tokens.length) {
				const nextTok = tokens[i + 1]
				const nextOffset = Number(nextTok?.o ?? offset)
				eTime = ts + nextOffset
				if (typeof nextTok?.c === "string" && nextTok.c.trim().length > 0) {
					isPartOfWord = true
				}
			}
			eTime = Math.max(sTime + 0.05, Math.min(eTime, te))
			syllables.push({
				Text: text.trim(),
				StartTime: sTime,
				EndTime: eTime,
				IsPartOfWord: isPartOfWord
			})
		}

		if (syllables.length === 0) continue
		const first = syllables[0]
		const last = syllables[syllables.length - 1]
		content.push({
			Type: "Vocal",
			OppositeAligned: false,
			Lead: {
				StartTime: first.StartTime,
				EndTime: Math.max(last.EndTime, te),
				Syllables: syllables
			}
		})
	}

	if (content.length === 0) return undefined
	return {
		Type: "Syllable",
		StartTime: content[0].Lead.StartTime,
		EndTime: content[content.length - 1].Lead.EndTime,
		Content: content
	}
}

const convertMusixmatchSubtitlesToLine = (subtitlesBody: string | any[], durationSeconds?: number): ProviderLyrics | undefined => {
	let lines: any[]
	if (typeof subtitlesBody === "string") {
		try { lines = JSON.parse(subtitlesBody) } catch { return undefined }
	} else if (Array.isArray(subtitlesBody)) {
		lines = subtitlesBody
	} else {
		return undefined
	}
	if (!Array.isArray(lines) || lines.length === 0) return undefined

	const content: LineVocal[] = []
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const text = line?.text
		if (typeof text !== "string" || text.trim().length === 0) continue
		const sTime = Number(line?.time?.total ?? line?.time)
		if (isNaN(sTime)) continue

		const nextLine = lines[i + 1]
		const nextTime = nextLine ? Number(nextLine?.time?.total ?? nextLine?.time) : undefined
		const fallbackEndTime = durationSeconds ?? (sTime + 5)
		const eTime = (nextTime !== undefined && !isNaN(nextTime) && nextTime > sTime)
			? nextTime
			: fallbackEndTime

		content.push({
			Type: "Vocal",
			Text: text,
			StartTime: sTime,
			EndTime: Math.max(sTime + 0.3, eTime),
			OppositeAligned: false
		})
	}

	if (content.length === 0) return undefined
	return {
		Type: "Line",
		StartTime: content[0].StartTime,
		EndTime: content[content.length - 1].EndTime,
		Content: content
	}
}

const fetchMusixmatchMacro = async (params: Record<string, string>, retry = true): Promise<any> => {
	const token = await GetMusixmatchToken()
	if (token === undefined) return undefined

	const query = new URLSearchParams({
		format: "json",
		namespace: "lyrics_richsynched",
		subtitle_format: "mxm",
		app_id: "mac-ios-v2.0",
		usertoken: token,
		optional_calls: "track.richsync",
		richsync_compact_type: "words",
		...params
	})

	const url = `https://apic-appmobile.musixmatch.com/ws/1.1/macro.subtitles.get?${query.toString()}`
	const headers = {
		Accept: "application/json",
		"User-Agent": "Musixmatch/2025120901 CFNetwork/3860.300.31 Darwin/25.2.0"
	}

	try {
		const res = await fetch(url, { headers })
		if (res.ok) {
			const data = await res.json()
			const statusCode = data?.message?.header?.status_code
			if ((statusCode === 401 || statusCode === 402) && retry) {
				cachedMusixmatchToken = undefined
				return fetchMusixmatchMacro(params, false)
			}
			return data
		}
	} catch {}

	return undefined
}

const parseMusixmatchMacro = (data: any, durationSeconds?: number): ProviderLyrics | undefined => {
	if (data === undefined || data === null) return undefined
	const macroCalls = data?.message?.body?.macro_calls
	if (macroCalls === undefined || typeof macroCalls !== "object") return undefined

	// 1. Try Richsync (word-level syllables)
	const richsyncCall = macroCalls["track.richsync.get"]
	if (richsyncCall?.message?.header?.status_code === 200) {
		const rawRichsync = richsyncCall?.message?.body?.richsync?.richsync_body
		if (typeof rawRichsync === "string" && rawRichsync.length > 0) {
			const syllableLyrics = convertMusixmatchRichsyncToSyllable(rawRichsync)
			if (syllableLyrics !== undefined) return syllableLyrics
		}
	}

	// 2. Try Subtitles (line-synced)
	const subtitlesCall = macroCalls["track.subtitles.get"]
	if (subtitlesCall?.message?.header?.status_code === 200) {
		const rawSubtitles =
			subtitlesCall?.message?.body?.subtitle?.subtitle_body ??
			subtitlesCall?.message?.body?.subtitle_list?.[0]?.subtitle?.subtitle_body
		if (typeof rawSubtitles === "string" && rawSubtitles.length > 0) {
			const lineLyrics = convertMusixmatchSubtitlesToLine(rawSubtitles, durationSeconds)
			if (lineLyrics !== undefined) return lineLyrics
		}
	}

	// 3. Try plain lyrics (static)
	const lyricsCall = macroCalls["track.lyrics.get"]
	if (lyricsCall?.message?.header?.status_code === 200) {
		const rawLyrics = lyricsCall?.message?.body?.lyrics?.lyrics_body
		if (typeof rawLyrics === "string" && rawLyrics.length > 0) {
			const cleaned = rawLyrics
				.replace(/\*+ This Lyrics is NOT for Commercial use \*+[\s\S]*$/i, "")
				.replace(/\(\d+\)\s*$/i, "")
				.trim()
			const staticLyrics = convertPlainTextToStatic(cleaned)
			if (staticLyrics !== undefined) return staticLyrics
		}
	}

	return undefined
}

export const FetchMusixmatchLyrics = async (
	trackId: string,
	artist?: string,
	title?: string,
	duration?: number
): Promise<ProviderLyrics | undefined> => {
	const cleanTrackId = trackId.replace(/^spotify:track:/, "").trim()
	const params: Record<string, string> = {}
	if (cleanTrackId.length > 0) {
		params.track_spotify_id = cleanTrackId
	}

	// Fallback to currently playing track metadata if artist or title not provided
	let effectiveArtist = artist
	let effectiveTitle = title
	if (!effectiveArtist || !effectiveTitle) {
		try {
			// deno-lint-ignore no-explicit-any
			const track = SpotifyPlayer?.data?.item as any
			const meta = track?.metadata
			effectiveTitle = effectiveTitle ?? (meta?.title ?? track?.name)
			effectiveArtist = effectiveArtist ?? (track?.artists?.[0]?.name ?? meta?.artist_name)
		} catch {}
	}

	if (effectiveArtist !== undefined && effectiveArtist.length > 0) params.q_artist = effectiveArtist
	if (effectiveTitle !== undefined && effectiveTitle.length > 0) params.q_track = effectiveTitle
	if (duration !== undefined && duration > 0) {
		params.q_duration = String(duration)
		params.f_subtitle_length = String(Math.floor(duration))
	}

	try {
		const data = await fetchMusixmatchMacro(params)
		const lyrics = parseMusixmatchMacro(data, duration)
		if (lyrics !== undefined) return lyrics

		// If direct lookup didn't match and we have artist/title, retry search
		if (effectiveArtist !== undefined && effectiveTitle !== undefined && effectiveArtist.length > 0 && effectiveTitle.length > 0) {
			return FetchMusixmatchSearchLyrics(effectiveArtist, effectiveTitle, duration)
		}
	} catch {}

	return undefined
}

export const FetchMusixmatchSearchLyrics = async (
	artist: string,
	title: string,
	duration?: number
): Promise<ProviderLyrics | undefined> => {
	const params: Record<string, string> = {
		q_artist: artist,
		q_track: title
	}
	if (duration !== undefined && duration > 0) {
		params.q_duration = String(duration)
		params.f_subtitle_length = String(Math.floor(duration))
	}

	try {
		const data = await fetchMusixmatchMacro(params)
		return parseMusixmatchMacro(data, duration)
	} catch {}

	return undefined
}

// Convert word-level JSON array (Deezer/Kugou format) to Syllable lyrics
export const convertWordArrayToSyllable = (lyrics: any[]): ProviderLyrics | undefined => {
	const content: SyllableVocalSet[] = []
	for (const line of lyrics) {
		const words = line?.text
		if (Array.isArray(words) === false || words.length === 0) continue
		const syllables: SyllableMetadata[] = []
		for (const w of words) {
			if (w.text === undefined || w.timestamp === undefined || w.endtime === undefined) continue
			if (w.endtime <= w.timestamp) continue
			syllables.push({
				Text: w.text,
				StartTime: w.timestamp / 1000,
				EndTime: w.endtime / 1000,
				IsPartOfWord: false
			})
		}
		if (syllables.length === 0) continue
		const first = syllables[0]; const last = syllables[syllables.length - 1]
		if (first === undefined || last === undefined) continue
		content.push({
			Type: "Vocal",
			OppositeAligned: false,
			Lead: { StartTime: first.StartTime, EndTime: last.EndTime, Syllables: syllables }
		})
	}
	if (content.length === 0) return undefined
	return { Type: "Syllable", StartTime: content[0].Lead.StartTime, EndTime: content[content.length - 1].Lead.EndTime, Content: content }
}

export const convertEnhancedLrcToSyllableLyrics = (enhancedLrc: string | undefined | null, durationSeconds?: number): ProviderLyrics | undefined => {
	if (enhancedLrc === undefined || enhancedLrc === null || enhancedLrc.trim().length === 0) return undefined

	const lineTimestampPattern = /^\[((?:\d{1,2}:)?\d{1,3}:\d{2}(?:[.,]\d{1,4})?)\]/
	const wordTimestampPattern = /<((?:\d{1,2}:)?\d{1,3}:\d{2}(?:[.,]\d{1,4})?)>/g

	type TimedPart = { time: number; text: string }
	const parsedLines: Array<{ lineTime: number; parts: TimedPart[] }> = []

	for (const rawLine of enhancedLrc.split(/\r?\n/)) {
		const lineMatch = lineTimestampPattern.exec(rawLine.trim())
		if (lineMatch === null) continue
		const lineTime = parseLrcTimestamp(lineMatch[1]!)
		if (lineTime === undefined) continue

		const body = rawLine.slice(lineMatch[0].length)
		const matches = [...body.matchAll(wordTimestampPattern)]
		if (matches.length === 0) continue

		const parts: TimedPart[] = []
		for (let i = 0; i < matches.length; i++) {
			const time = parseLrcTimestamp(matches[i][1]!)
			if (time === undefined) continue
			const textStart = (matches[i].index ?? 0) + matches[i][0].length
			const textEnd = i + 1 < matches.length ? (matches[i + 1].index ?? body.length) : body.length
			const text = body.slice(textStart, textEnd).replace(/\s+/g, " ").trim()
			if (text.length > 0) parts.push({ time, text })
		}
		if (parts.length > 0) parsedLines.push({ lineTime, parts })
	}

	parsedLines.sort((a, b) => a.lineTime - b.lineTime)
	if (parsedLines.length === 0) return undefined

	const content: SyllableVocalSet[] = []
	for (let li = 0; li < parsedLines.length; li++) {
		const line = parsedLines[li]
		const nextLine = parsedLines[li + 1]
		const fallbackEndTime = Math.max(line.lineTime + 3, durationSeconds ?? (line.lineTime + 5))
		const lineEndTime = (nextLine?.lineTime !== undefined && nextLine.lineTime > line.lineTime)
			? nextLine.lineTime
			: fallbackEndTime

		const syllables: SyllableMetadata[] = []
		for (let pi = 0; pi < line.parts.length; pi++) {
			const part = line.parts[pi]
			const nextPart = line.parts[pi + 1]
			const rawEndTime = (nextPart?.time !== undefined && nextPart.time > part.time)
				? nextPart.time
				: lineEndTime
			syllables.push({
				Text: part.text,
				StartTime: part.time,
				EndTime: Math.max(part.time + 0.05, rawEndTime),
				IsPartOfWord: false
			})
		}

		if (syllables.length === 0) continue
		const first = syllables[0]; const last = syllables[syllables.length - 1]
		if (first === undefined || last === undefined) continue

		content.push({
			Type: "Vocal",
			OppositeAligned: false,
			Lead: { StartTime: first.StartTime, EndTime: last.EndTime, Syllables: syllables }
		})
	}

	if (content.length === 0) return undefined
	return {
		Type: "Syllable",
		StartTime: content[0].Lead.StartTime,
		EndTime: content[content.length - 1].Lead.EndTime,
		Content: content
	}
}

// Try multiple parsing strategies on a paxsenix JSON response
export const parsePaxsenixResponse = (parsed: any, durationSeconds?: number): ProviderLyrics | undefined => {
	if (parsed === undefined || parsed === null) return undefined

	const possibleText = parsed.lyrics ?? parsed.plain_lyrics ?? parsed.plainLyrics ?? parsed.lyrics_body ?? (typeof parsed === "string" ? parsed : undefined)

	if (typeof possibleText === "string" && possibleText.length > 0) {
		return convertEnhancedLrcToSyllableLyrics(possibleText, durationSeconds)
			?? convertLrcToLineLyrics(possibleText, durationSeconds)
			?? convertPlainTextToStatic(possibleText)
	}

	if (Array.isArray(parsed.lyrics) && parsed.lyrics.length > 0) {
		return convertWordArrayToSyllable(parsed.lyrics)
	}
	if (Array.isArray(parsed.data) && parsed.data.length > 0) {
		return convertWordArrayToSyllable(parsed.data)
	}

	if (parsed.data && typeof parsed.data === "object") {
		const dataText = parsed.data.lyrics ?? parsed.data.plain_lyrics ?? parsed.data.plainLyrics
		if (typeof dataText === "string" && dataText.length > 0) {
			return convertEnhancedLrcToSyllableLyrics(dataText, durationSeconds)
				?? convertLrcToLineLyrics(dataText, durationSeconds)
				?? convertPlainTextToStatic(dataText)
		}
		if (Array.isArray(parsed.data.lyrics)) {
			return convertWordArrayToSyllable(parsed.data.lyrics)
		}
	}

	return undefined
}

// Provider: Beautiful Lyrics Reborn (txw.qzz.io)
export const FetchTxwLyrics = async (
	songId: string,
	trackName?: string,
	artistName?: string,
	albumName?: string,
	duration?: number
): Promise<ProviderLyrics | undefined> => {
	try {
		const url = new URL(`https://lyrics.txw.qzz.io/lyrics/${encodeURIComponent(songId)}`)
		if (trackName && trackName.length > 0) url.searchParams.set("track_name", trackName)
		if (artistName && artistName.length > 0) url.searchParams.append("artist_name", artistName)
		if (albumName && albumName.length > 0) url.searchParams.set("album_name", albumName)
		if (duration && Number.isFinite(duration) && duration > 0) {
			url.searchParams.set("duration", String(Math.round(duration)))
		}

		let token = "test"
		try {
			const fetchedToken = await GetSpotifyAccessToken()
			if (fetchedToken && fetchedToken.length > 0) token = fetchedToken
		} catch { /* ignore */ }

		const controller = new AbortController()
		const timeout = globalThis.setTimeout(() => controller.abort(), 7000)
		const resp = await fetch(url.toString(), {
			method: "GET",
			signal: controller.signal,
			headers: {
				Authorization: `Bearer ${token}`,
				"X-Spotify-App-Platform": SpotifyPlatform?.PlatformData?.app_platform ?? "Linux",
				"X-Spotify-App-Version": SpotifyPlatform?.version ?? "1.0.0"
			}
		}).finally(() => globalThis.clearTimeout(timeout))

		if (!resp.ok) return undefined
		const text = await resp.text()
		if (!text || text.length === 0) return undefined
		const json = JSON.parse(text)
		if (json && typeof json === "object" && typeof json.Type === "string") {
			return json as ProviderLyrics
		}
		return undefined
	} catch {
		return undefined
	}
}

// Provider: AMLLDB TTML syllable lyrics
export const FetchAMLLDBLyrics = (trackId: string): Promise<ProviderLyrics | undefined> => {
	return (
		fetch(`https://amll-ttml-db.stevexmh.net/spotify/${encodeURIComponent(trackId)}?format=ttml`, {
			headers: { Accept: "application/xml, text/xml, text/plain;q=0.9", "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.text())
		.then(text => text === undefined ? undefined : convertTtmlToSyllableLyrics(text))
		.catch(() => undefined)
	)
}

// Provider: Paxsenix Genius static lyrics
export const FetchGeniusLyrics = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	return (
		fetch(`https://genius.com/api/search/song?q=${encodeURIComponent(query)}`, {
			headers: { Accept: "application/json", "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			const hits = data?.response?.sections?.flatMap((s: any) => s.hits ?? []) ?? []
			const match = hits.find((hit: any) => {
				const r = hit?.result
				return r?.url !== undefined
			})
			return match?.result?.url
		})
		.then((url: string | undefined) => {
			if (url === undefined) return undefined
			return fetch(`https://lyrics.paxsenix.org/genius/lyrics?url=${encodeURIComponent(url)}`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined || data?.error === true) return undefined
			if (typeof data.lyrics === "string") return convertPlainTextToStatic(data.lyrics)
			return undefined
		})
		.catch(() => undefined)
	)
}

// Provider: Paxsenix Deezer word-level lyrics
export const FetchDeezerLyrics = (artist: string, title: string, duration?: number): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	const normalize = (v: string) => v.toLocaleLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^\p{L}\p{N}]/gu, "")

	return (
		fetch(`https://api.deezer.com/search/track?q=${encodeURIComponent(query)}`, {
			headers: { Accept: "application/json", "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			const songs = data?.data ?? []
			if (Array.isArray(songs) === false || songs.length === 0) return undefined

			const normalizedTitle = normalize(title)
			const normalizedArtist = normalize(artist)

			const match = songs.find((s: any) => {
				if (s.id === undefined) return false
				if (duration !== undefined && s.duration !== undefined) {
					if (Math.abs(s.duration - duration) > 10) return false
				}
				const st = normalize(s.title ?? "")
				const sa = normalize(s.artist?.name ?? "")
				return st.includes(normalizedTitle) && sa.includes(normalizedArtist)
			})

			return match?.id !== undefined ? String(match.id) : undefined
		})
		.then((deezerId: string | undefined) => {
			if (deezerId === undefined) return undefined
			return fetch(`https://lyrics.paxsenix.org/deezer/lyrics?id=${deezerId}`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined || data?.isError === true) return undefined

			if (Array.isArray(data.lyrics) && data.lyrics.length > 0) {
				return convertWordArrayToSyllable(data.lyrics)
			}

			if (typeof data.plain_lyrics === "string" && data.plain_lyrics.length > 0) {
				return convertPlainTextToStatic(data.plain_lyrics)
			}

			return parsePaxsenixResponse(data)
		})
		.catch(() => undefined)
	)
}

// Provider: Paxsenix YouTube line lyrics
export const FetchYouTubeLyrics = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	return (
		fetch(`https://lyrics.paxsenix.org/youtube/search?q=${encodeURIComponent(query)}`, {
			headers: { "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.json())
		.then((videos: any) => {
			if (Array.isArray(videos) === false || videos.length === 0) return undefined
			const video = videos[0]
			return video?.videoId
		})
		.then((videoId: string | undefined) => {
			if (videoId === undefined) return undefined
			return fetch(`https://lyrics.paxsenix.org/youtube/lyrics?id=${videoId}`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.text())
		.then(text => {
			if (text === undefined) return undefined
			let parsed: any
			try { parsed = JSON.parse(text) } catch { return convertLrcToLineLyrics(text) ?? convertPlainTextToStatic(text) }
			if (parsed && typeof parsed === "object") {
				const possibleText = parsed.lyrics ?? parsed.plain_lyrics
				if (typeof possibleText === "string") return convertLrcToLineLyrics(possibleText) ?? convertPlainTextToStatic(possibleText)
			}
			return undefined
		})
		.catch(() => undefined)
	)
}

// Provider: Paxsenix Netease line lyrics
export const FetchNeteaseLyrics = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	return (
		fetch(`https://lyrics.paxsenix.org/netease/search?q=${encodeURIComponent(query)}`, {
			headers: { "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			const songs = data?.result?.songs ?? data?.songs ?? []
			if (Array.isArray(songs) === false || songs.length === 0) return undefined
			return String(songs[0].id)
		})
		.then((neteaseId: string | undefined) => {
			if (neteaseId === undefined) return undefined
			return fetch(`https://lyrics.paxsenix.org/netease/lyrics?id=${neteaseId}`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined || data?.error === true) return undefined
			return parsePaxsenixResponse(data)
		})
		.catch(() => undefined)
	)
}

// Provider: Paxsenix QQ Music line lyrics
export const FetchQQMusicLyrics = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	return (
		fetch(`https://lyrics.paxsenix.org/qq/search?q=${encodeURIComponent(query)}`, {
			headers: { "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			const songs = data?.result?.songs ?? data?.songs ?? []
			if (Array.isArray(songs) === false || songs.length === 0) return undefined
			return String(songs[0].id ?? songs[0].songid)
		})
		.then((qqId: string | undefined) => {
			if (qqId === undefined) return undefined
			return fetch(`https://lyrics.paxsenix.org/qq/lyrics?id=${qqId}`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined || data?.error === true) return undefined
			return parsePaxsenixResponse(data)
		})
		.catch(() => undefined)
	)
}

// Provider: Paxsenix Kugou word-level lyrics
export const FetchKugouLyrics = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const query = `${title} ${artist}`
	return (
		fetch(`https://lyrics.paxsenix.org/kugou/search?q=${encodeURIComponent(query)}`, {
			headers: { "User-Agent": "BeautifulLyrics/1.0" }
		})
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			const songs = data?.data ?? data?.songs ?? []
			if (Array.isArray(songs) === false || songs.length === 0) return undefined
			return String(songs[0].id ?? songs[0].hash)
		})
		.then((kugouId: string | undefined) => {
			if (kugouId === undefined) return undefined
			return fetch(`https://lyrics.paxsenix.org/kugou/lyrics?id=${kugouId}&word=true`, {
				headers: { "User-Agent": "BeautifulLyrics/1.0" }
			})
		})
		.then(r => r?.ok === false || r === undefined ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined || data?.error === true) return undefined
			return parsePaxsenixResponse(data)
		})
		.catch(() => undefined)
	)
}

// Provider: BetterLyrics API - TTML (word-level timing)
export const FetchBetterLyricsTTML = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://lyrics-api.boidu.dev/getLyrics?s=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`
	return (
		fetch(url, { headers: { Accept: "application/json", "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined) return undefined
			const ttml: unknown = data.ttml
			if (typeof ttml !== "string" || ttml.length === 0) return undefined
			return convertTtmlToSyllableLyrics(ttml)
		})
		.catch(() => undefined)
	)
}

// Provider: BetterLyrics API - Kugou (line-level timing)
export const FetchBetterLyricsKugou = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://lyrics-api.boidu.dev/kugou/getLyrics?s=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`
	return (
		fetch(url, { headers: { Accept: "application/json", "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined) return undefined
			const lyrics: unknown = data.lyrics
			if (typeof lyrics !== "string" || lyrics.length === 0) return undefined
			return convertLrcToLineLyrics(lyrics) ?? convertPlainTextToStatic(lyrics)
		})
		.catch(() => undefined)
	)
}

// Provider: BetterLyrics API - Legacy (line-level timing)
export const FetchBetterLyricsLegacy = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://lyrics-api.boidu.dev/legacy/getLyrics?s=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`
	return (
		fetch(url, { headers: { Accept: "application/json", "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined) return undefined
			const lyrics: unknown = data.lyrics
			if (typeof lyrics !== "string" || lyrics.length === 0) return undefined
			return convertLrcToLineLyrics(lyrics) ?? convertPlainTextToStatic(lyrics)
		})
		.catch(() => undefined)
	)
}

// Provider: BetterLyrics API - QQ (line-level timing)
export const FetchBetterLyricsQQ = (artist: string, title: string): Promise<ProviderLyrics | undefined> => {
	const url = `https://lyrics-api.boidu.dev/qq/getLyrics?s=${encodeURIComponent(title)}&a=${encodeURIComponent(artist)}`
	return (
		fetch(url, { headers: { Accept: "application/json", "User-Agent": "BeautifulLyrics/1.0" } })
		.then(r => r.ok === false ? undefined : r.json())
		.then((data: any) => {
			if (data === undefined) return undefined
			const lyrics: unknown = data.lyrics
			if (typeof lyrics !== "string" || lyrics.length === 0) return undefined
			return convertLrcToLineLyrics(lyrics) ?? convertPlainTextToStatic(lyrics)
		})
		.catch(() => undefined)
	)
}

// Provider: lrc.red (used by Vivi Music, supports TTML word-sync & LRC line-sync)
export const FetchLrcRedLyrics = async (
	artist: string,
	title: string,
	isrc?: string,
	duration?: number
): Promise<ProviderLyrics | undefined> => {
	const headers = {
		"X-Client-ID": "BeautifulLyrics/1.0 (https://github.com/spicetify/spicetify-cli)",
		"User-Agent": "BeautifulLyrics/1.0"
	}

	// 1. Try direct ISRC lookup first if available
	if (isrc && isrc.length > 0) {
		try {
			const ttmlResp = await fetch(`https://lrc.red/s/${encodeURIComponent(isrc)}.ttml`, { headers })
			if (ttmlResp.ok) {
				const ttmlText = await ttmlResp.text()
				const syllableLyrics = convertTtmlToSyllableLyrics(ttmlText)
				if (syllableLyrics) return syllableLyrics
			}
			const lrcResp = await fetch(`https://lrc.red/s/${encodeURIComponent(isrc)}.lrc`, { headers })
			if (lrcResp.ok) {
				const lrcText = await lrcResp.text()
				const lineLyrics = convertLrcToLineLyrics(lrcText, duration)
				if (lineLyrics) return lineLyrics
			}
		} catch { /* proceed to search */ }
	}

	// 2. Search by track name & artist
	try {
		const query = `${title} ${artist}`.trim()
		const searchUrl = `https://lrc.red/search.json?q=${encodeURIComponent(query)}`
		const searchResp = await fetch(searchUrl, { headers })
		if (!searchResp.ok) return undefined
		const searchData = await searchResp.json()
		const hits = searchData?.hits
		if (!Array.isArray(hits) || hits.length === 0) return undefined

		let bestHit = hits[0]
		if (duration && duration > 0) {
			const durMatch = hits.find((h: any) => typeof h.duration === "number" && Math.abs(h.duration - duration) < 5)
			if (durMatch) bestHit = durMatch
		}

		const hitIsrc = bestHit?.isrc
		if (!hitIsrc) return undefined

		// Fetch TTML first for word-level sync
		const ttmlResp = await fetch(`https://lrc.red/s/${encodeURIComponent(hitIsrc)}.ttml`, { headers })
		if (ttmlResp.ok) {
			const ttmlText = await ttmlResp.text()
			const syllableLyrics = convertTtmlToSyllableLyrics(ttmlText)
			if (syllableLyrics) return syllableLyrics
		}

		// Fallback to LRC
		const lrcResp = await fetch(`https://lrc.red/s/${encodeURIComponent(hitIsrc)}.lrc`, { headers })
		if (lrcResp.ok) {
			const lrcText = await lrcResp.text()
			const lineLyrics = convertLrcToLineLyrics(lrcText, duration ?? bestHit?.duration)
			if (lineLyrics) return lineLyrics
		}
	} catch {
		return undefined
	}

	return undefined
}
