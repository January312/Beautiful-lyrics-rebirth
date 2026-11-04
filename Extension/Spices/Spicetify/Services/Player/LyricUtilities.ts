// Shared Boundary Modules
import type {
	Lyrics as ProviderLyrics,
	TextMetadata,
	LineVocal
} from "@Universal/Types/Lyrics.ts"
export type { ProviderLyrics }

import { SpotifyPlayer } from "../Session.ts"

// Language Modules
import { franc } from "npm:franc@^6.2.0"
import {
	romanizeKorean,
	romanizeJapanese,
	romanizeChinese,
	romanizeDevanagari,
	romanizeGurmukhi,
	romanizeCyrillic,
	romanizeGreek,
	romanizeArabic,
	KoreanRegex,
	JapaneseRegex,
	ChineseRegex,
	DevanagariRegex,
	GurmukhiRegex,
	CyrillicRegex,
	GreekRegex,
	ArabicRegex,
	type RomanizedLanguage
} from "./RomanizationEngine.ts"
export type { RomanizedLanguage }

// Lyrics Types
type NaturalAlignment = ("Right" | "Left")

type BaseInformation = {
	NaturalAlignment: NaturalAlignment;
	Language: string;
	RomanizedLanguage?: RomanizedLanguage;
}
export type TransformedLyrics = (
	BaseInformation
	& ProviderLyrics
)

// Behavior Constants
// Romanization separator ("" = spaces, "-" = hyphens, "." = dots)
let romanizationSeparator = ""
export const SetRomanizationSeparator = (sep: string): void => { romanizationSeparator = sep }

const MinimumInterludeDuration = 2
const EndInterludeEarlyBy = 0.25 // Seconds before our analytical end. This is used as a prep for the next vocal

// Language Recognition Constants
const RightToLeftLanguages = [
	// Persian
	'pes', 'urd',
	
	// Arabic Languages
	'arb', 'uig', // Do not include "zlm" (Malay), it is in Arabic script but it's not written right-to-left

	// Hebrew Languages
	'heb', 'ydd',

	// Mende Languages
	'men'
]

// Strip all diacritical marks (ā→a, ś→s, ṭ→t, etc.)
export const stripDiacritics = (text: string): string => (
	text.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
)

// Helper Methods
const GetNaturalAlignment = (language: string): NaturalAlignment => {
	return (RightToLeftLanguages.includes(language) ? "Right" : "Left")
}

const HindiLanguageCodes = new Set([
	"hin", "san", "mar", "nep", "kok", "bho", "mai", "doi", "kas", "snd"
])

const CyrillicLanguageCodes = new Set([
	"rus", "ukr", "bel", "bul", "mkd", "srp", "kaz", "kir", "tgk", "mon"
])

const ArabicLanguageCodes = new Set([
	"arb", "pes", "urd", "uig", "prs", "fas"
])

const GenerateJapaneseRomanization = async <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (primaryLanguage === "jpn" || JapaneseRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = await romanizeJapanese(lyricMetadata.Text, romanizationSeparator)
		return "Japanese"
	}
}

const GenerateKoreanRomanization = <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (primaryLanguage === "kor" || KoreanRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = romanizeKorean(lyricMetadata.Text, romanizationSeparator)
		return Promise.resolve("Korean")
	}
	return Promise.resolve()
}

const GenerateChineseRomanization = async <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (primaryLanguage === "cmn" || primaryLanguage === "zho" || ChineseRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = await romanizeChinese(lyricMetadata.Text, romanizationSeparator)
		return "Chinese"
	}
}

const GenerateHindiRomanization = <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (HindiLanguageCodes.has(primaryLanguage) || DevanagariRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = romanizeDevanagari(lyricMetadata.Text, romanizationSeparator)
		return Promise.resolve("Hindi")
	}
	return Promise.resolve()
}

const GeneratePunjabiRomanization = <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (primaryLanguage === "pan" || GurmukhiRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = romanizeGurmukhi(lyricMetadata.Text, romanizationSeparator)
		return Promise.resolve("Punjabi")
	}
	return Promise.resolve()
}

const GenerateCyrillicRomanization = <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (CyrillicLanguageCodes.has(primaryLanguage) || CyrillicRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = romanizeCyrillic(lyricMetadata.Text, romanizationSeparator)
		return Promise.resolve("Cyrillic")
	}
	return Promise.resolve()
}

const GenerateGreekRomanization = <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (primaryLanguage === "ell" || primaryLanguage === "grc" || GreekRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = romanizeGreek(lyricMetadata.Text, romanizationSeparator)
		return Promise.resolve("Greek")
	}
	return Promise.resolve()
}

const GenerateArabicRomanization = <L extends TextMetadata>(
	lyricMetadata: L,
	primaryLanguage: string
): Promise<RomanizedLanguage | void> => {
	if (ArabicLanguageCodes.has(primaryLanguage) || ArabicRegex.test(lyricMetadata.Text)) {
		lyricMetadata.RomanizedText = romanizeArabic(lyricMetadata.Text, romanizationSeparator)
		return Promise.resolve("Arabic")
	}
	return Promise.resolve()
}

const GenerateRomanization = async <L extends TextMetadata, I extends BaseInformation>(
	lyricMetadata: L,
	rootInformation: I
): Promise<void> => {
	// If romanization is already provided by the source (e.g. TTML x-roman), keep it as-is
	if (lyricMetadata.RomanizedText !== undefined && lyricMetadata.RomanizedText.length > 0) {
		return
	}

	const lang = (await GenerateJapaneseRomanization(lyricMetadata, rootInformation.Language))
		?? (await GenerateKoreanRomanization(lyricMetadata, rootInformation.Language))
		?? (await GenerateChineseRomanization(lyricMetadata, rootInformation.Language))
		?? (await GenerateHindiRomanization(lyricMetadata, rootInformation.Language))
		?? (await GeneratePunjabiRomanization(lyricMetadata, rootInformation.Language))
		?? (await GenerateCyrillicRomanization(lyricMetadata, rootInformation.Language))
		?? (await GenerateGreekRomanization(lyricMetadata, rootInformation.Language))
		?? (await GenerateArabicRomanization(lyricMetadata, rootInformation.Language))

	if (lang) {
		rootInformation.RomanizedLanguage = lang
	}
}

// Synthesize character-weighted proportional line timing for static lyrics
export const ForceSyncStaticLyrics = (lyrics: ProviderLyrics, durationSeconds?: number): ProviderLyrics => {
	if (lyrics.Type !== "Static" || !Array.isArray(lyrics.Lines) || lyrics.Lines.length === 0) {
		return lyrics
	}

	const totalLines = lyrics.Lines.length
	// deno-lint-ignore no-explicit-any
	const itemDuration = Number((SpotifyPlayer.data?.item as any)?.duration ?? 0)
	let songDuration = (typeof durationSeconds === "number" && durationSeconds > 0)
		? durationSeconds
		: (itemDuration > 0 ? itemDuration / 1000 : 0)

	if (!songDuration || songDuration <= 0) {
		songDuration = totalLines * 3.5 + 10
	}

	const introPadding = Math.min(12, Math.max(2, songDuration * 0.05))
	const outroPadding = Math.min(15, Math.max(3, songDuration * 0.06))
	const activeDuration = Math.max(10, songDuration - introPadding - outroPadding)

	const weights: number[] = []
	let totalWeight = 0
	for (const line of lyrics.Lines) {
		const text = line.Text ? line.Text.trim() : ""
		const w = Math.max(15, text.length)
		weights.push(w)
		totalWeight += w
	}

	let currentStartTime = introPadding
	const content: LineVocal[] = []

	for (let i = 0; i < totalLines; i++) {
		const line = lyrics.Lines[i]
		const lineFraction = totalWeight > 0 ? (weights[i] / totalWeight) : (1 / totalLines)
		const lineDuration = Math.max(1.5, lineFraction * activeDuration)
		const lineEndTime = currentStartTime + lineDuration

		content.push({
			Type: "Vocal",
			Text: line.Text,
			StartTime: currentStartTime,
			EndTime: lineEndTime,
			OppositeAligned: false,
			RomanizedText: line.RomanizedText
		})

		currentStartTime = lineEndTime
	}

	return {
		Type: "Line",
		StartTime: content[0].StartTime,
		EndTime: content[content.length - 1].EndTime,
		Content: content
	}
}

// Transformation Methods
export const TransformProviderLyrics = (providerLyrics: ProviderLyrics, durationSeconds?: number): Promise<TransformedLyrics> => {
	// If provider lyrics are static, synthesize line sync timing so they scroll, highlight, and animate!
	const sourceLyrics = (providerLyrics.Type === "Static")
		? ForceSyncStaticLyrics(providerLyrics, durationSeconds)
		: providerLyrics

	// Type-case for the future
	const lyrics = (sourceLyrics as TransformedLyrics)

	// First, determine our language/natural-alignment and then romanize
	const romanizationPromises: Promise<void>[] = []
	if (lyrics.Type === "Static") {
		// Determine our language AND natural-alignment
		{
			// Put all our text together for processing
			let textToProcess = lyrics.Lines[0].Text
			for (let index = 1; index < lyrics.Lines.length; index += 1) {
				textToProcess += `\n${lyrics.Lines[index].Text}`
			}

			// Determine our language
			const language = franc(textToProcess)

			// Now update our natural alignment and language
			lyrics.Language = language
			lyrics.NaturalAlignment = GetNaturalAlignment(language)
		}

		// Go through and romanize everything
		for(const lyricMetadata of lyrics.Lines) {
			romanizationPromises.push(GenerateRomanization(lyricMetadata, lyrics))
		}
	} else if (lyrics.Type === "Line") {
		// Determine our language AND natural-alignment
		{
			// Put all our text together for processing
			const lines = []
			for (const vocalGroup of lyrics.Content) {
				if (vocalGroup.Type === "Vocal") {
					lines.push(vocalGroup.Text)
				}
			}
			const textToProcess = lines.join("\n") 

			// Determine our language
			const language = franc(textToProcess)

			// Now update our natural alignment and language
			lyrics.Language = language
			lyrics.NaturalAlignment = GetNaturalAlignment(language)
		}

		// Go through and romanize everything
		for(const vocalGroup of lyrics.Content) {
			if (vocalGroup.Type == "Vocal") {
				romanizationPromises.push(GenerateRomanization(vocalGroup, lyrics))
			}
		}
	} else if (lyrics.Type === "Syllable") {
		// Determine our language AND natural-alignment
		{
			// Put all our text together for processing
			const lines = []
			for (const vocalGroup of lyrics.Content) {
				if (vocalGroup.Type === "Vocal") {
					let text = vocalGroup.Lead.Syllables[0].Text
					for (let index = 1; index < vocalGroup.Lead.Syllables.length; index += 1) {
						const syllable = vocalGroup.Lead.Syllables[index]
						text += `${syllable.IsPartOfWord ? "" : " "}${syllable.Text}`
					}

					lines.push(text)
				}
			}
			const textToProcess = lines.join("\n") 

			// Determine our language
			const language = franc(textToProcess)

			// Now update our natural alignment and language
			lyrics.Language = language
			lyrics.NaturalAlignment = GetNaturalAlignment(language)
		}

		// Go through and romanize everything
		for(const vocalGroup of lyrics.Content) {
			if (vocalGroup.Type == "Vocal") {
				for(const syllable of vocalGroup.Lead.Syllables) {
					romanizationPromises.push(GenerateRomanization(syllable, lyrics))
				}

				if (vocalGroup.Background !== undefined) {
					for(const syllable of vocalGroup.Background[0].Syllables) {
						romanizationPromises.push(GenerateRomanization(syllable, lyrics))
					}
				}
			}
		}
	}

	return (
		// Wait for our romaniazation process to finish
		Promise.all(romanizationPromises)

		// Then add in interludes according to our preferences
		.then(
			() => {
				if (lyrics.Type === "Static") {
					return
				}

				// Go through and grab our start/end times
				const vocalTimes: {
					StartTime: number;
					EndTime: number;
				}[] = []
				if (lyrics.Type === "Line") {
					for(const vocal of lyrics.Content) {
						if (vocal.Type === "Vocal") {
							vocalTimes.push(
								{
									StartTime: vocal.StartTime,
									EndTime: vocal.EndTime
								}
							)
						}
					}
				} else if (lyrics.Type === "Syllable") {
					for(const vocal of lyrics.Content) {
						if (vocal.Type === "Vocal") {
							let startTime = vocal.Lead.StartTime, endTime = vocal.Lead.EndTime
							if (vocal.Background !== undefined) {
								for(const backgroundVocal of vocal.Background) {
									startTime = Math.min(startTime, backgroundVocal.StartTime)
									endTime = Math.max(endTime, backgroundVocal.EndTime)
								}
							}
							vocalTimes.push(
								{
									StartTime: startTime,
									EndTime: endTime
								}
							)
						}
					}
				}

				// First check if our first vocal-group needs an interlude before it
				let addedStartInterlude = false
				{
					const firstVocalGroup = vocalTimes[0]

					if (firstVocalGroup.StartTime >= MinimumInterludeDuration) {
						vocalTimes.unshift({StartTime: -1, EndTime: -1})
						lyrics.Content.unshift(
							{
								Type: "Interlude",

								StartTime: 0,
								EndTime: (firstVocalGroup.StartTime - EndInterludeEarlyBy)
							}
						)

						addedStartInterlude = true
					}
				}

				// Now go through our vocals and determine if we need to add an interlude anywhere
				for (
					let index = (vocalTimes.length - 1);
					index > (addedStartInterlude ? 1 : 0);
					index -= 1
				) {
					const endingVocalGroup = vocalTimes[index]
					const startingVocalGroup = vocalTimes[index - 1]

					if ((endingVocalGroup.StartTime - startingVocalGroup.EndTime) >= MinimumInterludeDuration) {
						vocalTimes.splice(index, 0, {StartTime: -1, EndTime: -1})
						lyrics.Content.splice(
							index,
							0,
							{
								Type: "Interlude",

								StartTime: startingVocalGroup.EndTime,
								EndTime: (endingVocalGroup.StartTime - EndInterludeEarlyBy)
							}
						)
					}
				}
			}
		)

		// Finally, return our lyrics
		.then(() => lyrics)
	)
}