// Enhanced Multi-Language Romanization Engine with Word Teaching & Accurate Pronunciation
// Supports: Korean, Japanese, Chinese, Hindi, Punjabi, Cyrillic (Russian/Ukrainian), Greek, Arabic

import Kuroshiro from "npm:@sglkc/kuroshiro@^1.0.1"
import * as KuromojiAnalyzer from "./KuromojiAnalyzer.ts"
import pinyin from "@Pinyin/Source/main.ts"
import Aromanize from "./Aromanize.ts"

// Romanized Language Type
export type RomanizedLanguage =
	| "Chinese"
	| "Japanese"
	| "Korean"
	| "Hindi"
	| "Punjabi"
	| "Cyrillic"
	| "Greek"
	| "Arabic"

// Kuroshiro Instance
const RomajiConverter = new Kuroshiro()
let romajiInitPromise: Promise<void> | undefined

const ensureKuroshiro = (): Promise<void> => {
	if (!romajiInitPromise) {
		romajiInitPromise = RomajiConverter.init(KuromojiAnalyzer).catch((err) => {
			console.warn("Kuromoji init failed, falling back to built-in Kana engine:", err)
		})
	}
	return romajiInitPromise
}
ensureKuroshiro()

// Script Detection Regexes
export const KoreanRegex = /[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f\ua960-\ua97f\ud7b0-\ud7ff]/
export const ChineseRegex = /[\u4E00-\u9FFF]/
export const JapaneseRegex = /[\u3040-\u309F\u30A0-\u30FF]/
export const DevanagariRegex = /[\u0900-\u097F]/
export const GurmukhiRegex = /[\u0A00-\u0A7F]/
export const CyrillicRegex = /[\u0400-\u04FF\u0500-\u052F]/
export const GreekRegex = /[\u0370-\u03FF\u1F00-\u1FFF]/
export const ArabicRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/

// ==========================================
// 1. TAUGHT WORDS DICTIONARIES (ACCURATE SPELLINGS)
// ==========================================

export const KOREAN_TAUGHT_WORDS: Record<string, string> = {
	"사랑해": "saranghae", "사랑해요": "saranghaeyo", "사랑": "sarang", "사랑하는": "saranghaneun",
	"보고싶어": "bogo sipeo", "보고싶다": "bogo sipda", "보고싶어해": "bogo sipeohae",
	"미안해": "mianhae", "미안해요": "mianhaeyo", "죄송해요": "joesonghaeyo",
	"영원히": "yeongwonhi", "영원": "yeongwon", "영원토록": "yeongwontorok",
	"오빠": "oppa", "누나": "nuna", "형": "hyeong", "언니": "eonni",
	"친구": "chingu", "친구야": "chinguya", "마음": "maeum", "마음이": "maeumi",
	"눈물": "nunmul", "눈물이": "nunmuri", "하루": "haru", "하루하루": "haruharu",
	"행복": "haengbok", "행복해": "haengbokhae", "추억": "chueok", "시간": "sigan",
	"노래": "norae", "세상": "sesang", "세상이": "sesangi", "하늘": "haneul",
	"하늘이": "haneuri", "바람": "baram", "우리": "uri", "우리는": "urineun", "우릴": "uril",
	"너를": "neoreul", "널": "neol", "나를": "nareul", "날": "nal",
	"지금": "jigeum", "진짜": "jinjja", "정말": "jeongmal", "너무": "neomu",
	"괜찮아": "gwaenchana", "아니야": "aniya", "몰라": "molla", "좋아": "joa",
	"좋아해": "joahae", "예뻐": "yeppeo", "어디": "eodi", "언제": "eonje",
	"어떻게": "eotteoke", "이렇게": "ireoke", "그렇게": "geureoke", "저렇게": "jeoreoke",
	"왜": "wae", "네가": "nega", "내가": "naega", "제발": "jebal",
	"약속": "yaksok", "기억": "gieok", "기억해": "gieokhae", "꿈": "kkum", "꿈을": "kkumeul",
	"별": "byeol", "달": "dal", "빛": "bit", "빛나": "binna", "밤": "bam", "오늘밤": "oneulbam",
	"꽃": "kkot", "비": "bi", "눈": "nun", "손": "son", "손을": "soneul",
	"입술": "ipsul", "가슴": "gaseum", "가슴이": "gaseumi", "숨": "sum",
	"끝": "kkeut", "끝없이": "kkeuteopsi", "시작": "sijak", "다시": "dasi",
	"함께": "hamkke", "혼자": "honja", "원해": "wonhae", "많이": "manhi",
	"매일": "maeil", "항상": "hangsang", "가끔": "gakkeum", "잊지마": "itjima",
	"가지마": "gajima", "안녕": "annyeong", "머리": "meori", "얼굴": "eolgul",
	"아침": "achim", "태양": "taeyang", "그대": "geudae", "그대의": "geudaeui",
	"어제": "eoje", "내일": "naeil", "웃어": "useo", "울지마": "uljima"
}

export const JAPANESE_TAUGHT_WORDS: Record<string, string> = {
	"私": "watashi", "わたし": "watashi", "僕": "boku", "ぼく": "boku", "俺": "ore",
	"君": "kimi", "きみ": "kimi", "貴方": "anata", "あなた": "anata", "愛": "ai",
	"恋": "koi", "心": "kokoro", "今": "ima", "夢": "yume", "声": "koe", "空": "sora",
	"涙": "namida", "夜": "yoru", "今夜": "konya", "世界": "sekai", "明日": "ashita",
	"未来": "mirai", "過去": "kako", "時間": "jikan", "今日": "kyou", "昨日": "kinou",
	"誰": "dare", "何": "nani", "人": "hito", "時": "toki", "道": "michi",
	"手": "te", "目": "me", "胸": "mune", "命": "inochi", "光": "hikari",
	"風": "kaze", "雨": "ame", "花": "hana", "歌": "uta", "音": "oto",
	"言葉": "kotoba", "想い": "omoi", "記憶": "kioku", "運命": "unmei", "永遠": "eien",
	"笑顔": "egao", "優しさ": "yasashisa", "理由": "riyuu", "場所": "basho",
	"奇跡": "kiseki", "願い": "negai", "星": "hoshi", "太陽": "taiyou", "月": "tsuki",
	"海": "umi", "桜": "sakura", "大丈夫": "daijoubu", "ありがとう": "arigatou",
	"さようなら": "sayounara", "いつも": "itsumo", "ずっと": "zutto", "もっと": "motto",
	"きっと": "kitto", "本当": "hontou", "愛してる": "aishiteru", "好き": "suki",
	"大好き": "daisuki", "どこ": "doko", "ここ": "koko", "そこ": "soko",
	"約束": "yakusoku", "一人": "hitori", "ふたり": "futari", "二人": "futari",
	"一緒": "issho", "そば": "soba", "信じて": "shinjite", "忘れない": "wasurenai",
	"行こう": "ikou", "生きる": "ikiru", "綺麗": "kirei", "温もり": "nukumori",
	"悲しみ": "kanashimi", "切ない": "setsunai", "季節": "kisetsu", "希望": "kibou"
}

export const CHINESE_TAUGHT_WORDS: Record<string, string> = {
	"音乐": "yin yue", "乐器": "yue qi", "乐团": "yue tuan", "乐曲": "yue qu",
	"快乐": "kuai le", "欢乐": "huan le", "乐趣": "le qu", "乐观": "le guan",
	"长大": "zhang da", "长高": "zhang gao", "长辈": "zhang bei",
	"很长": "hen chang", "长路": "chang lu", "长度": "chang du", "长久": "chang jiu",
	"重新": "chong xin", "重复": "chong fu", "重来": "chong lai", "重温": "chong wen",
	"重要": "zhong yao", "重量": "zhong liang", "沉重": "chen zhong",
	"觉得": "jue de", "感觉": "gan jue", "自觉": "zi jue", "觉醒": "jue xing",
	"睡觉": "shui jiao", "午觉": "wu jiao",
	"看着": "kan zhe", "听着": "ting zhe", "走着": "zou zhe", "说着": "shuo zhe",
	"着急": "zhao ji", "着迷": "zhao mi", "着火": "zhao huo",
	"好的": "hao de", "是的": "shi de", "真的": "zhen de", "目的": "mu di",
	"慢慢地": "man man de", "静静地": "jing jing de", "轻轻地": "qing qing de",
	"星星": "xing xing", "月亮": "yue liang", "太阳": "tai yang", "世界": "shi jie",
	"我们": "wo men", "你们": "ni men", "他们": "ta men", "她们": "ta men",
	"没有": "mei you", "不是": "bu shi", "喜欢": "xi huan", "爱情": "ai qing",
	"永远": "yong yuan", "回忆": "hui yi", "等待": "deng dai", "离开": "li kai",
	"温柔": "wen rou", "拥抱": "yong bao", "微笑": "wei xiao", "眼泪": "yan lei",
	"如果": "ru guo", "因为": "yin wei", "所以": "suo yi", "承诺": "cheng nuo",
	"心跳": "xin tiao", "呼吸": "hu xi", "幸福": "xing fu", "梦想": "meng xiang"
}

export const HINDI_TAUGHT_WORDS: Record<string, string> = {
	"ज़िंदगी": "zindagi", "जिंदगी": "zindagi", "मोहब्बत": "mohabbat", "इश्क़": "ishq", "इश्क": "ishq",
	"दीवाना": "deewana", "दीवानी": "deewani", "तू": "tu", "तुम": "tum", "हम": "hum", "आप": "aap",
	"दिल": "dil", "प्यार": "pyaar", "सनम": "sanam", "यारा": "yaara", "यार": "yaar",
	"आँखों": "aankhon", "आंखों": "aankhon", "आँखें": "aankhen", "धड़कन": "dhadkan",
	"सांसें": "saansen", "सांस": "saans", "ख़ुदा": "khuda", "खुदा": "khuda", "दुआ": "dua",
	"सफ़र": "safar", "सफर": "safar", "दर्द": "dard", "चैन": "chain", "ख़्वाब": "khwaab", "ख्वाब": "khwaab",
	"रात": "raat", "चाँद": "chaand", "चांद": "chaand", "तारे": "taare", "मौसम": "mausam",
	"हवाएं": "hawayen", "दुनिया": "duniya", "जहान": "jahaan", "नज़र": "nazar", "नजर": "nazar",
	"फ़िक्र": "fikr", "फिक्र": "fikr", "क़रीब": "qareeb", "करीब": "qareeb", "आशिक़ी": "aashiqui", "आशिकी": "aashiqui",
	"तेरा": "tera", "मेरी": "meri", "मेरा": "mera", "तेरे": "tere", "मेरे": "mere",
	"हो": "ho", "है": "hai", "था": "tha", "थी": "thi", "थे": "the", "नहीं": "nahin",
	"कभी": "kabhi", "सब": "sab", "कुछ": "kuch", "कहो": "kaho", "सुनो": "suno",
	"जान": "jaan", "जाना": "jaana", "पास": "paas", "दूर": "door", "याद": "yaad",
	"मुस्कान": "muskaan", "खुशी": "khushi", "गम": "gham", "ज़माना": "zamaana",
	"बेवफा": "bewafa", "तन्हा": "tanha", "आवाज़": "aawaaz", "आवाज": "aawaaz"
}

export const PUNJABI_TAUGHT_WORDS: Record<string, string> = {
	"ਜ਼ਿੰਦਗੀ": "zindagi", "ਜਿੰਦਗੀ": "zindagi", "ਯਾਰ": "yaar", "ਯਾਰੀ": "yaari",
	"ਜੱਟ": "jatt", "ਸੋਹਣੀ": "sohni", "ਸੋਹਣਾ": "sohna", "ਮੁੰਡਾ": "munda", "ਕੁੜੀ": "kuri",
	"ਦਿਲ": "dil", "ਪਿਆਰ": "pyaar", "ਅੱਖਾਂ": "akkhaan", "ਅੱਖ": "akkh",
	"ਇਸ਼ਕ": "ishq", "ਗੀਤ": "geet", "ਗੱਲ": "gall", "ਰਾਹ": "raah", "ਸ਼ੌਂਕ": "shonk",
	"ਵੈਲੀ": "vailly", "ਗੱਡੀ": "gaddi", "ਸੂਟ": "suit", "ਨਖਰਾ": "nakhra",
	"ਤਾਰੇ": "taare", "ਤੇਰੇ": "tere", "ਮੇਰੇ": "mere", "ਤੇਰਾ": "tera", "ਮੇਰਾ": "mera",
	"ਕੋਈ": "koi", "ਨਹੀਂ": "nahin", "ਹੋਵੇ": "hove", "ਰੱਬ": "rabb", "ਸੱਚ": "sach",
	"ਝੂਠ": "jhooth", "ਵੇ": "ve", "ਨੀ": "nee", "ਹਾਏ": "haaye", "ਹਾਂ": "haan"
}

// Utility: Apply taught dictionary replacements across whole words or phrases
const applyTaughtDictionary = (text: string, dict: Record<string, string>): { text: string; replaced: boolean } => {
	let res = text
	let replaced = false
	// Sort keys by length descending to match longest phrases first
	const keys = Object.keys(dict).sort((a, b) => b.length - a.length)
	for (const key of keys) {
		if (res.includes(key)) {
			res = res.split(key).join(` ${dict[key]} `)
			replaced = true
		}
	}
	if (replaced) {
		res = res.replace(/\s{2,}/g, " ").trim()
	}
	return { text: res, replaced }
}

// ==========================================
// 2. KOREAN ROMANIZATION (REVISED ROMANIZATION TRANSCRIPTION)
// ==========================================

export const romanizeKorean = (text: string, separator = ""): string => {
	// First check taught dictionary
	const { text: preTaught } = applyTaughtDictionary(text, KOREAN_TAUGHT_WORDS)
	// Use RevisedRomanizationTranscription (correct phonetic transcription with liaison & batchim)
	const raw = Aromanize(preTaught, "RevisedRomanizationTranscription")
	const cleaned = raw
		.replace(/\s+([,.:;!?])/g, "$1")
		.replace(/([,.:;!?])(?=[a-zA-Z])/g, "$1 ")
		.replace(/\s{2,}/g, " ")
		.trim()
	return separator ? cleaned.replace(/ /g, separator) : cleaned
}

// ==========================================
// 3. JAPANESE ROMANIZATION (Kuroshiro + Offline Kana Fallback + Macron Polish)
// ==========================================

// Built-in Kana to Hepburn Romaji Map (100% offline fallback)
const KANA_HEPBURN: Record<string, string> = {
	// Hiragana
	"あ": "a", "い": "i", "う": "u", "え": "e", "お": "o",
	"か": "ka", "き": "ki", "く": "ku", "け": "ke", "こ": "ko",
	"さ": "sa", "し": "shi", "す": "su", "せ": "se", "そ": "so",
	"た": "ta", "ち": "chi", "つ": "tsu", "て": "te", "と": "to",
	"な": "na", "に": "ni", "ぬ": "nu", "ね": "ne", "の": "no",
	"は": "ha", "ひ": "hi", "ふ": "fu", "へ": "he", "ほ": "ho",
	"ま": "ma", "み": "mi", "む": "mu", "め": "me", "も": "mo",
	"や": "ya", "ゆ": "yu", "よ": "yo",
	"ら": "ra", "り": "ri", "る": "ru", "れ": "re", "ろ": "ro",
	"わ": "wa", "を": "o", "ん": "n",
	"が": "ga", "ぎ": "gi", "ぐ": "gu", "げ": "ge", "ご": "go",
	"ざ": "za", "じ": "ji", "ず": "zu", "ぜ": "ze", "ぞ": "zo",
	"だ": "da", "ぢ": "ji", "づ": "zu", "де": "de", "ど": "do",
	"ば": "ba", "び": "bi", "ぶ": "bu", "べ": "be", "ぼ": "bo",
	"ぱ": "pa", "ぴ": "pi", "ぷ": "pu", "ぺ": "pe", "ぽ": "po",
	// Digraphs
	"きゃ": "kya", "きゅ": "kyu", "きょ": "kyo",
	"しゃ": "sha", "しゅ": "shu", "しょ": "sho",
	"ちゃ": "cha", "ちゅ": "chu", "ちょ": "cho",
	"にゃ": "nya", "にゅ": "nyu", "にょ": "nyo",
	"ひゃ": "hya", "ひゅ": "hyu", "ひょ": "hyo",
	"みゃ": "mya", "みゅ": "myu", "みょ": "myo",
	"りゃ": "rya", "りゅ": "ryu", "りょ": "ryo",
	"ぎゃ": "gya", "ぎゅ": "gyu", "ぎょ": "gyo",
	"じゃ": "ja", "じゅ": "ju", "じょ": "jo",
	"びゃ": "bya", "びゅ": "byu", "びょ": "byo",
	"ぴゃ": "pya", "ぴゅ": "pyu", "ぴょ": "pyo",

	// Katakana
	"ア": "a", "イ": "i", "ウ": "u", "エ": "e", "オ": "o",
	"カ": "ka", "キ": "ki", "ク": "ku", "ケ": "ke", "コ": "ko",
	"サ": "sa", "シ": "shi", "ス": "su", "セ": "se", "ソ": "so",
	"タ": "ta", "チ": "chi", "ツ": "tsu", "テ": "te", "ト": "to",
	"ナ": "na", "ニ": "ni", "ヌ": "nu", "ネ": "ne", "ノ": "no",
	"ハ": "ha", "ヒ": "hi", "フ": "fu", "ヘ": "he", "ホ": "ho",
	"マ": "ma", "ミ": "mi", "ム": "mu", "メ": "me", "モ": "mo",
	"ヤ": "ya", "ユ": "yu", "ヨ": "yo",
	"ラ": "ra", "リ": "ri", "ル": "ru", "レ": "re", "ロ": "ro",
	"ワ": "wa", "ヲ": "o", "ン": "n",
	"ガ": "ga", "ギ": "gi", "グ": "gu", "ゲ": "ge", "ゴ": "go",
	"ザ": "za", "ジ": "ji", "ズ": "zu", "ゼ": "ze", "ゾ": "zo",
	"ダ": "da", "ヂ": "ji", "ヅ": "zu", "デ": "de", "ド": "do",
	"バ": "ba", "ビ": "bi", "ブ": "bu", "ベ": "be", "ボ": "bo",
	"パ": "pa", "ピ": "pi", "プ": "pu", "ペ": "pe", "ポ": "po",
	// Katakana digraphs & extended
	"キャ": "kya", "キュ": "kyu", "キョ": "kyo",
	"シャ": "sha", "シュ": "shu", "ショ": "sho",
	"チャ": "cha", "チュ": "chu", "チョ": "cho",
	"ニャ": "nya", "ニュ": "nyu", "ニョ": "nyo",
	"ヒャ": "hya", "ヒュ": "hyu", "ヒョ": "hyo",
	"ミャ": "mya", "ミュ": "myu", "ミョ": "myo",
	"リャ": "rya", "リュ": "ryu", "リョ": "ryo",
	"ギャ": "gya", "ギュ": "gyu", "ギョ": "gyo",
	"ジャ": "ja", "ジュ": "ju", "ジョ": "jo",
	"ビャ": "bya", "ビュ": "byu", "ビョ": "byo",
	"ピャ": "pya", "ピュ": "pyu", "ピョ": "pyo",
	"ティ": "ti", "ディ": "di", "チェ": "che", "シェ": "she", "ジェ": "je",
	"ファ": "fa", "フィ": "fi", "フェ": "fe", "フォ": "fo",
	"ウィ": "wi", "ウェ": "we", "ウォ": "wo",
	"ヴァ": "va", "ヴィ": "vi", "ヴ": "vu", "ヴェ": "ve", "ヴォ": "vo"
}

export const fallbackKanaToRomaji = (text: string): string => {
	let out = ""
	let i = 0
	let lastVowel = ""

	while (i < text.length) {
		const two = text.slice(i, i + 2)
		if (KANA_HEPBURN[two]) {
			out += KANA_HEPBURN[two]
			lastVowel = KANA_HEPBURN[two].slice(-1)
			i += 2
			continue
		}

		const one = text[i]
		// Sokuon (small tsu / consonant doubling)
		if (one === "っ" || one === "ッ") {
			const nextTwo = text.slice(i + 1, i + 3)
			const nextOne = text[i + 1]
			const target = KANA_HEPBURN[nextTwo] || KANA_HEPBURN[nextOne]
			if (target && target.length > 0) {
				const firstChar = target[0].toLowerCase()
				if (firstChar === "c") {
					out += "t"
				} else {
					out += firstChar
				}
			}
			i++
			continue
		}

		// Chōonpu (long vowel dash)
		if (one === "ー") {
			if (lastVowel) out += lastVowel
			i++
			continue
		}

		if (KANA_HEPBURN[one]) {
			out += KANA_HEPBURN[one]
			lastVowel = KANA_HEPBURN[one].slice(-1)
			i++
			continue
		}

		out += one
		i++
	}

	return out
}

export const postProcessJapaneseRomaji = (romaji: string): string => {
	return romaji
		// Expand macrons to standard song spellings (so arigatō becomes arigatou, kyō becomes kyou)
		.replace(/ō/g, "ou").replace(/ū/g, "uu").replace(/ā/g, "aa").replace(/ē/g, "ee").replace(/ī/g, "ii")
		.replace(/Ō/g, "Ou").replace(/Ū/g, "Uu").replace(/Ā/g, "Aa").replace(/Ē/g, "Ee").replace(/Ī/g, "Ii")
		// Correct Japanese grammar particles when isolated as words
		.replace(/\bha\b/g, "wa")
		.replace(/\bhe\b/g, "e")
		.replace(/\bwo\b/g, "o")
		// Clean up punctuation spacing
		.replace(/\s+([,.:;!?。、！？])/g, "$1")
		.replace(/([,.:;!?。、！？])(?=[a-zA-Z])/g, "$1 ")
		.replace(/\s{2,}/g, " ")
		.trim()
}

export const romanizeJapanese = async (text: string, separator = ""): Promise<string> => {
	// 1. Check taught Japanese song dictionary
	const { text: preTaught, replaced } = applyTaughtDictionary(text, JAPANESE_TAUGHT_WORDS)

	// If whole string was taught words, polish and return
	if (!JapaneseRegex.test(preTaught)) {
		const polished = postProcessJapaneseRomaji(preTaught)
		return separator ? polished.replace(/ /g, separator) : polished
	}

	let result = ""
	try {
		await ensureKuroshiro()
		result = await RomajiConverter.convert(preTaught, {
			to: "romaji",
			mode: "spaced"
		})
	} catch (_) {
		// Fallback to built-in Kana engine if Kuroshiro fails
		result = fallbackKanaToRomaji(preTaught)
	}

	const polished = postProcessJapaneseRomaji(result)
	return separator ? polished.replace(/ /g, separator) : polished
}

// ==========================================
// 4. CHINESE ROMANIZATION (Segmented Pinyin + Polyphonic Disambiguation)
// ==========================================

export const romanizeChinese = async (text: string, separator = ""): Promise<string> => {
	// 1. Check taught Chinese song dictionary (disambiguates 音乐, 快乐, 长大, etc.)
	const { text: preTaught } = applyTaughtDictionary(text, CHINESE_TAUGHT_WORDS)

	try {
		// Use segment: true to disambiguate polyphonic phrases
		const pyResult: string[][] = await pinyin(preTaught, {
			segment: true,
			group: true,
			style: 0 // tone-less standard song reading
		})

		const words: string[] = []
		for (const item of pyResult) {
			const str = Array.isArray(item) ? item[0] : item
			if (!str) continue
			words.push(str)
		}

		let joined = words.join(" ")
			.replace(/ ，/g, ",")
			.replace(/ 。/g, ".")
			.replace(/ ！/g, "!")
			.replace(/ ？/g, "?")
			.replace(/ ；/g, ";")
			.replace(/ ：/g, ":")
			.replace(/\s+([,.:;!?])/g, "$1")
			.replace(/([,.:;!?])(?=[a-zA-Z])/g, "$1 ")
			.replace(/\s{2,}/g, " ")
			.trim()

		return separator ? joined.replace(/ /g, separator) : joined
	} catch (e) {
		console.warn("Pinyin conversion failed, fallback:", e)
		return text
	}
}

// ==========================================
// 5. HINDI (DEVANAGARI) ROMANIZATION (Nukta & Schwa Deletion)
// ==========================================

const DEVANAGARI_CONS: Record<string, string> = {
	"\u0915": "k", "\u0916": "kh", "\u0917": "g", "\u0918": "gh", "\u0919": "n",
	"\u091a": "ch", "\u091b": "chh", "\u091c": "j", "\u091d": "jh", "\u091e": "ny",
	"\u091f": "t", "\u0920": "th", "\u0921": "d", "\u0922": "dh", "\u0923": "n",
	"\u0924": "t", "\u0925": "th", "\u0926": "d", "\u0927": "dh", "\u0928": "n",
	"\u092a": "p", "\u092b": "ph", "\u092c": "b", "\u092d": "bh", "\u092e": "m",
	"\u092f": "y", "\u0930": "r", "\u0932": "l", "\u0933": "l", "\u0935": "v",
	"\u0936": "sh", "\u0937": "sh", "\u0938": "s", "\u0939": "h",
	"\u0958": "q", "\u0959": "kh", "\u095a": "gh", "\u095b": "z", "\u095c": "r",
	"\u095d": "rh", "\u095e": "f", "\u095f": "y",
}

const DEVANAGARI_VOWEL: Record<string, string> = {
	"\u0905": "a", "\u0906": "aa", "\u0907": "i", "\u0908": "i", "\u0909": "u",
	"\u090a": "u", "\u090b": "ri", "\u090c": "li", "\u090f": "e", "\u0910": "ai",
	"\u0913": "o", "\u0914": "au",
}

const DEVANAGARI_MATRA: Record<string, string> = {
	"\u093e": "aa", "\u093f": "i", "\u0940": "i", "\u0941": "u", "\u0942": "u",
	"\u0943": "ri", "\u0944": "ri", "\u0947": "e", "\u0948": "ai",
	"\u094b": "o", "\u094c": "au",
}

const DEVANAGARI_NUKTA_MAP: Record<string, string> = {
	"\u0915": "q", "\u0916": "kh", "\u0917": "gh", "\u091c": "z",
	"\u0921": "r", "\u0922": "rh", "\u092b": "f"
}

export const romanizeDevanagari = (text: string, separator = ""): string => {
	const { text: preTaught } = applyTaughtDictionary(text, HINDI_TAUGHT_WORDS)
	const normalized = preTaught.normalize("NFC")
	const tokens = normalized.split(/\b/)

	const result = tokens.map((word) => {
		let out = ""
		let i = 0
		while (i < word.length) {
			const ch = word[i]
			if (ch < "\u0900" || ch > "\u097f") {
				out += ch
				i++
				continue
			}
			if (ch === "\u094d" || ch === "\u200c" || ch === "\u200d") {
				i++
				continue
			}
			if (DEVANAGARI_VOWEL[ch]) {
				out += DEVANAGARI_VOWEL[ch]
				i++
				continue
			}
			if (ch === "\u0901" || ch === "\u0902") {
				out += "n"
				i++
				continue
			}
			if (ch === "\u0903") {
				out += "h"
				i++
				continue
			}

			let consName = DEVANAGARI_CONS[ch]
			if (consName) {
				// Check for following nukta
				if (i + 1 < word.length && word[i + 1] === "\u093c") {
					consName = DEVANAGARI_NUKTA_MAP[ch] || consName
					i++
				}
				i++
				// Halant (virama) -> suppress vowel
				if (i < word.length && word[i] === "\u094d") {
					out += consName
					i++
					continue
				}
				// Matra
				if (i < word.length && DEVANAGARI_MATRA[word[i]]) {
					out += consName + DEVANAGARI_MATRA[word[i]]
					i++
					continue
				}
				// Schwa deletion at word boundaries
				const isWordEnd = i >= word.length || !/[\u0900-\u097f]/.test(word[i])
				if (isWordEnd) {
					out += consName
				} else {
					out += consName + "a"
				}
				continue
			}
			i++
		}
		return out
	}).join("")

	const cleaned = result
		.replace(/\s+([,.:;!?])/g, "$1")
		.replace(/([,.:;!?])(?=[a-zA-Z])/g, "$1 ")
		.replace(/\s{2,}/g, " ")
		.trim()

	return separator ? cleaned.replace(/ /g, separator) : cleaned
}

// ==========================================
// 6. PUNJABI (GURMUKHI) ROMANIZATION (Addak Gemination & Pairin Bindi)
// ==========================================

const GURMUKHI_CONS: Record<string, string> = {
	"\u0a15": "k", "\u0a16": "kh", "\u0a17": "g", "\u0a18": "gh", "\u0a19": "n",
	"\u0a1a": "ch", "\u0a1b": "chh", "\u0a1c": "j", "\u0a1d": "jh", "\u0a1e": "n",
	"\u0a1f": "t", "\u0a20": "th", "\u0a21": "d", "\u0a22": "dh", "\u0a23": "n",
	"\u0a24": "t", "\u0a25": "th", "\u0a26": "d", "\u0a27": "dh", "\u0a28": "n",
	"\u0a2a": "p", "\u0a2b": "ph", "\u0a2c": "b", "\u0a2d": "bh", "\u0a2e": "m",
	"\u0a2f": "y", "\u0a30": "r", "\u0a32": "l", "\u0a33": "l", "\u0a35": "v",
	"\u0a36": "sh", "\u0a38": "s", "\u0a39": "h",
	"\u0a59": "kh", "\u0a5a": "gh", "\u0a5b": "z", "\u0a5c": "r", "\u0a5e": "f"
}

const GURMUKHI_VOWEL: Record<string, string> = {
	"\u0a05": "a", "\u0a06": "aa", "\u0a07": "i", "\u0a08": "i", "\u0a09": "u",
	"\u0a0a": "u", "\u0a0f": "e", "\u0a10": "ai", "\u0a13": "o", "\u0a14": "au",
}

const GURMUKHI_MATRA: Record<string, string> = {
	"\u0a3e": "aa", "\u0a3f": "i", "\u0a40": "i", "\u0a41": "u", "\u0a42": "u",
	"\u0a47": "e", "\u0a48": "ai", "\u0a4b": "o", "\u0a4c": "au",
}

const GURMUKHI_NUKTA_MAP: Record<string, string> = {
	"\u0a38": "sh", "\u0a16": "kh", "\u0a17": "gh", "\u0a1c": "z",
	"\u0a2b": "f", "\u0a32": "l"
}

export const romanizeGurmukhi = (text: string, separator = ""): string => {
	const { text: preTaught } = applyTaughtDictionary(text, PUNJABI_TAUGHT_WORDS)
	const normalized = preTaught.normalize("NFC")
	const tokens = normalized.split(/\b/)

	const result = tokens.map((word) => {
		let out = ""
		let i = 0
		let pendingAddak = false

		while (i < word.length) {
			const ch = word[i]
			if (ch < "\u0a00" || ch > "\u0a7f") {
				out += ch
				i++
				continue
			}
			if (ch === "\u0a4d" || ch === "\u200c" || ch === "\u200d") {
				i++
				continue
			}
			// Addak (gemination/double consonant)
			if (ch === "\u0a71") {
				pendingAddak = true
				i++
				continue
			}
			// Tippi or Bindi (nasal)
			if (ch === "\u0a70" || ch === "\u0a02") {
				out += "n"
				i++
				continue
			}
			if (GURMUKHI_VOWEL[ch]) {
				out += GURMUKHI_VOWEL[ch]
				i++
				continue
			}

			let consName = GURMUKHI_CONS[ch]
			if (consName) {
				// Pairin bindi (nukta)
				if (i + 1 < word.length && word[i + 1] === "\u0a3c") {
					consName = GURMUKHI_NUKTA_MAP[ch] || consName
					i++
				}
				if (pendingAddak) {
					out += consName[0]
					pendingAddak = false
				}
				i++
				// Virama
				if (i < word.length && word[i] === "\u0a4d") {
					out += consName
					i++
					continue
				}
				// Matra
				if (i < word.length && GURMUKHI_MATRA[word[i]]) {
					out += consName + GURMUKHI_MATRA[word[i]]
					i++
					continue
				}
				// Schwa deletion at word boundaries
				const isWordEnd = i >= word.length || !/[\u0a00-\u0a7f]/.test(word[i])
				if (isWordEnd) {
					out += consName
				} else {
					out += consName + "a"
				}
				continue
			}
			i++
		}
		return out
	}).join("")

	const cleaned = result
		.replace(/\s+([,.:;!?])/g, "$1")
		.replace(/([,.:;!?])(?=[a-zA-Z])/g, "$1 ")
		.replace(/\s{2,}/g, " ")
		.trim()

	return separator ? cleaned.replace(/ /g, separator) : cleaned
}

// ==========================================
// 7. CYRILLIC (RUSSIAN / UKRAINIAN / SLAVIC) ROMANIZATION
// ==========================================

const CYRILLIC_MAP: Record<string, string> = {
	"а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "yo", "ж": "zh",
	"з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
	"п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "kh", "ц": "ts",
	"ч": "ch", "ш": "sh", "щ": "shch", "ъ": "", "ы": "y", "ь": "", "э": "e", "ю": "yu",
	"я": "ya", "є": "ye", "і": "i", "ї": "yi", "ґ": "g",
	"А": "A", "Б": "B", "В": "V", "Г": "G", "Д": "D", "Е": "E", "Ё": "Yo", "Ж": "Zh",
	"З": "Z", "И": "I", "Й": "Y", "К": "K", "Л": "L", "М": "M", "Н": "N", "О": "O",
	"П": "P", "Р": "R", "С": "S", "Т": "T", "У": "U", "Ф": "F", "Х": "Kh", "Ц": "Ts",
	"Ч": "Ch", "Ш": "Sh", "Щ": "Shch", "Ъ": "", "Ы": "Y", "Ь": "", "Э": "E", "Ю": "Yu",
	"Я": "Ya", "Є": "Ye", "І": "I", "Ї": "Yi", "Ґ": "G"
}

export const romanizeCyrillic = (text: string, separator = ""): string => {
	const out = text.split("").map(c => CYRILLIC_MAP[c] ?? c).join("")
	const cleaned = out.replace(/\s{2,}/g, " ").trim()
	return separator ? cleaned.replace(/ /g, separator) : cleaned
}

// ==========================================
// 8. GREEK ROMANIZATION
// ==========================================

const GREEK_MAP: Record<string, string> = {
	"α": "a", "β": "v", "γ": "g", "δ": "d", "ε": "e", "ζ": "z", "η": "i", "θ": "th",
	"ι": "i", "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x", "ο": "o", "π": "p",
	"ρ": "r", "σ": "s", "ς": "s", "τ": "t", "υ": "y", "φ": "f", "χ": "ch", "ψ": "ps", "ω": "o",
	"ά": "a", "έ": "e", "ή": "i", "ί": "i", "ό": "o", "ύ": "y", "ώ": "o",
	"Α": "A", "Β": "V", "Γ": "G", "Δ": "D", "Ε": "E", "Ζ": "Z", "Η": "I", "Θ": "Th",
	"Ι": "I", "Κ": "K", "Λ": "L", "Μ": "M", "Ν": "N", "Ξ": "X", "Ο": "O", "Π": "P",
	"Ρ": "R", "Σ": "S", "Τ": "T", "Υ": "Y", "Φ": "F", "Χ": "Ch", "Ψ": "Ps", "Ω": "O",
	"Ά": "A", "Έ": "E", "Ή": "I", "Ί": "I", "Ό": "O", "Ύ": "Y", "Ώ": "O"
}

export const romanizeGreek = (text: string, separator = ""): string => {
	let s = text
		.replace(/ου/gi, "ou")
		.replace(/αι/gi, "ai")
		.replace(/ει/gi, "ei")
		.replace(/οι/gi, "oi")
		.replace(/μπ/gi, "b")
		.replace(/ντ/gi, "d")
		.replace(/γκ/gi, "g")
	const out = s.split("").map(c => GREEK_MAP[c] ?? c).join("")
	const cleaned = out.replace(/\s{2,}/g, " ").trim()
	return separator ? cleaned.replace(/ /g, separator) : cleaned
}

// ==========================================
// 9. ARABIC / PERSIAN ROMANIZATION
// ==========================================

const ARABIC_MAP: Record<string, string> = {
	"ا": "a", "أ": "a", "إ": "i", "آ": "aa", "ب": "b", "ت": "t", "ث": "th", "ج": "j",
	"ح": "h", "خ": "kh", "د": "d", "ذ": "dh", "ر": "r", "ز": "z", "س": "s", "ش": "sh",
	"ص": "s", "ض": "d", "ط": "t", "ظ": "z", "ع": "a", "غ": "gh", "ف": "f", "ق": "q",
	"ك": "k", "ل": "l", "م": "m", "ن": "n", "ه": "h", "و": "w", "ي": "y", "ى": "a",
	"ة": "h", "ء": "", "ؤ": "u", "ئ": "i", "پ": "p", "چ": "ch", "ژ": "zh", "گ": "g",
	"َ": "a", "ُ": "u", "ِ": "i", "ً": "an", "ٌ": "un", "ٍ": "in", "ّ": "", "ْ": ""
}

export const romanizeArabic = (text: string, separator = ""): string => {
	const out = text.split("").map(c => ARABIC_MAP[c] ?? c).join("")
	const cleaned = out.replace(/\s{2,}/g, " ").trim()
	return separator ? cleaned.replace(/ /g, separator) : cleaned
}
