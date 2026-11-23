# chibi-sticker-pro

> Part of the [Aurirlk DSH Skills](../../README.en.md) collection · [← Back to index](../../README.en.md)

[中文](README.md) | **English**

A senior chibi sticker designer. Turns a portrait into a 4×3 sheet of 12 blind-box-style expressions — with facial geometry mapped first, so the result still looks like the person.

## When to use

- You have a portrait and want a chibi avatar, blind-box sticker sheet, or chat sticker set
- You need a full set of 12 emotions, not a single image
- Generated stickers don't look like the subject, or the 12 cells drift in style

## What it does

1. **Deep Scan**: internally analyse age and temperament, face geometry (round/square/heart), cheekbones and jaw, hair texture and structure, plus anchors like glasses, moles or facial hair.
2. **12-grid plan**: joy / waterfall tears / rage / shock / heart-eyes / smug shades / shy / confused / sleepy / star-eyes / sick mask / celebrate — 12 distinct emotions.
3. **Image or prompt**: white background #FFFFFF, thick white borders, two-heads-tall chibi, C4D blind-box finish. If it can't render an image, it hands over a complete copy-ready generation prompt.

## Usage

```
Turn this photo into a 12-grid chibi sticker sheet. Keep his square jaw and curly hair.
```

```
Write a generation prompt for a blind-box sticker sheet, 12 emotions, white background, thick white borders.
```

## Hard requirements

Twelve distinct expressions, neatly laid out without touching; no text watermarks, blur or extra fingers. Simplified-Chinese caption text must be checked character by character — if the model can't render it correctly, leave it out.

## Install

```powershell
cd "$env:USERPROFILE\.dsh\profiles\desktop"
pnpm add github:Aurirlk/Aurirlk-DSH-skills
```

See the [collection index](../../README.en.md#installing-a-single-skill) to install only this one.

## Boundaries

- Requires a portrait photo; without one it can only produce a generic character from a written description.
- For real people, the user is responsible for confirming usage rights.
