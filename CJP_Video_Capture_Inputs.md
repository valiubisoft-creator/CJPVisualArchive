# CJP Video Capture: Research Inputs for Claude Code

Answers to the five inputs requested before running the real YouTube data capture.

---

## 1. Boolean search query

**English:**
```
(CJP|"Cockroach Janta Party"|"Cockroach Janata Party"|"Chalo Sansad"|"Sansad Chalo"|"Abhijeet Dipke"|"Sonam Wangchuk"|dharna|protest|march|"lathi charge"|"tear gas") (Delhi|"New Delhi"|"Jantar Mantar"|"Sansad Marg"|"Parliament Street"|"Connaught Place")
```

**Hindi:**
```
(कॉकरोच जनता पार्टी|चलो संसद|अभिजीत दिपके|सोनम वांगचुक|धरना|प्रदर्शन|आंसू गैस|लाठीचार्ज) (जंतर मंतर|दिल्ली|संसद)
```

"Chalo Sansad" is the movement's own campaign name for the 20 July march, taken directly from their site, likely to tag a large share of relevant uploads. Sanity-check transliteration spellings against actual returned video titles once results come back, variants exist.

---

## 2. Key channels

**Verified official channel:** `@cockroachrevolution2029`, confirmed directly from the party's own official website's linked handles, not from a generic channel search.

**Warning:** A plain YouTube search for "Cockroach Janta Party" returns at least five or six other channels self-labeled as official, including at least one unrelated comedy/meme channel and an auto-generated topic page. None of these are the real one. Hardcode the verified handle above rather than letting a channel search auto-select one, otherwise the dataset risks being seeded from an impersonator account.

**News channels:** enumerate the outlets already anchoring the incident ledger and map dataset, since they're already verified sources:
- CNN-News18
- India Today
- The Hindu
- Times of India
- The Wire
- News Laundry
- The Indian Express
- Hindustan Times
- Lallantop

**Citizen uploaders:** don't pre-select and deep-enumerate specific individual people's channels. That's building a targeting list of private citizens rather than searching public content, and it runs into the identifiability concern already flagged for this project. Let the keyword and hashtag search (`#ChaloSansad`, `#CockroachJantaParty`) surface citizen footage organically. Reserve "deep enumerate" treatment for clearly branded, movement-adjacent accounts (a citizen-journalism handle operating under the movement's name), not personal channels.

---

## 3. Date window

**`2026-05-15` → `2026-08-15`**

Key dates inside this window:
- 16 May 2026: movement founded
- Early-mid June 2026: first Jantar Mantar protest
- 20 June 2026: second Jantar Mantar protest
- 20-21 July 2026: Chalo Sansad march, police crackdown, main escalation

Starting the day before founding catches origin content; ending mid-August leaves room for continued fallout coverage without pulling in unrelated noise from a wider window.

---

## 4. Go-ahead on quota

This authorization has to come directly from Vali to Claude Code, it runs against his own key and quota, not anything accessible from this side.

For reference: a few hundred quota units is roughly 2 to 4 `search.list` calls at 100 units each, against a 10,000/day budget. Light touch either way, with plenty of room to re-run the same day if the first pass needs refining.

---

## 5. Core issues for the taxonomy

Skip labor, farmers, citizenship, caste, that's a different movement's vocabulary. CJP's grievances, pulled from their own manifesto (released 15 July 2026) and origin story:

- **Exam and education system integrity** — the actual trigger: a leaked NEET medical entrance exam paper forcing a mass retake.
- **Youth unemployment and economic precarity** — central to the movement's own self-branding ("Voice of the Lazy & Unemployed"), not subtext.
- **Judicial and institutional accountability** — traces to the Chief Justice's original remark that sparked the movement, echoed in a manifesto demand about post-retirement Rajya Sabha seats.
- **Electoral integrity** — a manifesto demand concerning vote deletion and the Election Commission.
- **Gender representation** — a specific demand for 50% reservation for women in Parliament and Cabinet.
- **Media ownership and independence** — a demand targeting Ambani- and Adani-owned media licenses.
- **Anti-defection reform** — a 20-year bar demanded for MLAs/MPs who switch parties.
- **Police conduct and civil liberties** — emerged live during the 20 July crackdown (excessive force, surveillance complaints), not an original manifesto demand.

The last item is worth keeping distinct in the taxonomy: it documents something that happened *to* the movement during suppression, rather than something the movement is protesting *for*. That distinction likely matters for how the theme facet reads later.
