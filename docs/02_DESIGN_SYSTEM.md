# SparkSquad — Design System

The reference designs are in `design/*.dc.html` (15 screens, 390×844). They are the **source of truth for look and feel**. Match their colours, sizes, spacing, radii and copy exactly; extend the same language to every other screen in `03_SCREENS.md`.

Inspiration: openGym's discipline (neutral surface ramp, hairlines instead of borders, one accent, font weight carries meaning, motion that acknowledges rather than decorates) with SparkSquad's own identity (amber "spark" accent, squad ring).

## Principles
1. **One accent.** Amber is for primary actions, streaks and "checked in". Everything else is neutral.
2. **Hairlines, not boxes.** Lists are grouped inside one rounded surface with 0.5 px separators.
3. **Weight carries meaning.** 600 for titles/names, 400–500 for content. Size does the rest.
4. **Never shame.** Missed = neutral grey. Red only for destructive actions (Delete account).
5. **Thumb zone.** Primary action at the bottom; the centre tab button is always "Check in".
6. **Motion acknowledges.** Press scale ~0.98, 140–220 ms ease-out. One celebratory moment: check-in success (ring fills, small haptic). Respect reduced motion.
7. **Signature element: the squad ring** — member avatars that get an amber ring when they've checked in today.

## Colour tokens (dark is the default theme)

| Token | Dark | Light (build later, keep tokens ready) | Use |
|---|---|---|---|
| `bg` | `#000000` | `#F2F2F7` | screen background |
| `bgElevated` | `#0E0E10` | `#F7F7FA` | tab bar, input bars, sheets backdrop |
| `surface` | `#151517` | `#FFFFFF` | cards, grouped lists |
| `surface2` | `#232326` | `#EDEDF1` | inputs, nested chips, steppers |
| `surface3` | `#2A2A2E` | `#E3E3E8` | progress tracks, close buttons |
| `control` | `#1C1C1F` | `#E9E9EE` | segmented track, secondary buttons |
| `controlSelected` | `#3A3A3F` | `#FFFFFF` | segmented selected pill |
| `label` | `#F5F5F7` | `#000000` | primary text |
| `label2` | `#A1A1A8` | `#5F5F66` | secondary text (passes 4.5:1 on surface) |
| `label3` | `#8E8E95` | `#7A7A80` | captions, helper text |
| `iconMuted` | `#6E6E75` | `#9A9AA0` | chevrons |
| `tabInactive` | `#9A9AA0` | `#7A7A80` | inactive tab label/icon |
| `separator` | `rgba(84,84,88,0.6)` | `rgba(60,60,67,0.29)` | 0.5 px hairlines |
| `accent` | `#FFB224` | `#E89A00` | primary actions, streaks, rings |
| `accentPressed` | `#FFC75C` | `#CC8700` | pressed/hover |
| `onAccent` | `#1A1200` | `#1A1200` | text/icons on accent |
| `accentSoft` | `rgba(255,178,36,0.14)` | `rgba(232,154,0,0.12)` | secondary buttons, chips, icon tiles |
| `success` | `#3DDC97` | `#1F9D66` | done ticks, verified, switches on |
| `successSoft` | `rgba(61,220,151,0.12)` | `rgba(31,157,102,0.12)` | success chips |
| `onSuccess` | `#04140C` | `#FFFFFF` | tick on success circle |
| `missed` | `#5A5A60` | `#B5B5BA` | missed day dots, empty task circle outline |
| `danger` | `#FF6B60` | `#D93025` | destructive text only |
| `avatar1…12` | `#3B3A5C #2F4A45 #4A3A2F #3A2F4A #2F3F4A #2F2F4A #4A2F3A #3F4A2F #4A442F #2F4A3B #4A2F45 #3A4A2F` | lighter tints | initials avatars, assigned by hashing user id |

## Typography
- **Bricolage Grotesque** (500–700) — titles, big numbers, stat values. Install `@expo-google-fonts/bricolage-grotesque`.
- **Inter** (400, 500, 600) — all UI text. Install `@expo-google-fonts/inter`.
- Use tabular numbers (`fontVariant: ['tabular-nums']`) for every number.

| Style | Font | Size/Line | Weight | Use |
|---|---|---|---|---|
| `largeTitle` | Bricolage | 34/40, letterSpacing −0.5 | 700 | root tab titles (Today, Discover, Settings) |
| `title1` | Bricolage | 28/34, −0.3 | 700 | pushed screen titles (squad name, Import a plan) |
| `title2` | Bricolage | 22–24/28 | 600 | card titles (DSA 60, Day 12 check-in) |
| `statXL` | Bricolage | 44–56 | 700 | squad count "6/9" |
| `stat` | Bricolage | 20–30 | 600–700 | stat tiles, scores |
| `headline` | Inter | 17/22 | 600 | nav titles, primary button text |
| `body` | Inter | 15/21 | 400–500 | rows, task titles |
| `callout` | Inter | 16/22–23 | 400 | intro paragraphs |
| `footnote` | Inter | 13/18 | 400–600 | meta lines, section labels, segmented text |
| `caption` | Inter | 12/16–17 | 400 | helper text under controls |
| `tab` | Inter | 11 | 500 | tab bar labels (minimum size anywhere) |

## Spacing, radius, sizes
- 4 px grid. Screen side padding **16**. Gaps: 2/4/6/8/10/12/14/16/18/20/24.
- Top safe area: content starts below the status bar (designs use 52–60 px; use `useSafeAreaInsets`). Bottom: tab bar 84 px incl. home indicator.
- Radius: cards **22**, grouped lists **16–18**, inputs/primary buttons **14**, small buttons **12**, segmented **10/8**, chips/pills = height/2, avatars round, sheets top **22**.
- Touch targets ≥ 44×44. Primary button height **52**, secondary 44–48, chips 30–36, list rows 52–56.
- Avatars: 28 (compact rows), 32 (lists), 40 (share card/welcome), 56 (profile). Ring = `2px gap in surface colour + 2px accent`.

## Components (build in `apps/mobile/src/components/ui`)
Button (primary/secondary/soft/ghost/destructive), IconButton (circular 36/44), Card, GroupedList + ListRow (title, subtitle, value, chevron, switch), SectionLabel, SegmentedControl (3 options, track `control`, pill `controlSelected`), ChipToggle (selected = label bg + black text), Stepper (− value +, `surface2` track), Switch (iOS style, on = success), TextField / TextArea with counter, SearchField, Avatar (initials, colour by hash, `checked` ring, `dimmed`), AvatarRing (row/overlap and grid variants), TaskRow (circle tick 26 px inside 44 px target, done = success fill + dark tick), DayStrip (7 days: done dot success, missed dot grey, today = accent fill, review day = dashed outline, future dimmed), PhaseBar (segments), ProgressBar (6 px, track `surface3`), StatTile, Heatmap (18 weeks × 7, 4 levels of accent opacity 0/.35/.65/1), Badge, BottomSheet (grabber 36×5), TabBar (5 slots: Today, Squads, centre 56 px accent Check-in button raised −14 px with soft amber shadow, Discover, You), NavHeader (back chevron + label in accent), Toast, EmptyState (icon tile, one sentence, one CTA), Skeleton, OfflineBanner, ShareCard (rendered offscreen and captured with react-native-view-shot).

## Icons
Stroke icons, 1.8 stroke, round caps (lucide-react-native matches: calendar, users, check, compass, user, flame, bell, share, image, copy, file-up, message-circle, lock, search, plus, chevron-left/right, x, settings, flag, clock). No emoji in UI.

## Accessibility
Real buttons with `accessibilityLabel` on icon-only buttons; `accessibilityRole` on switches/radios/tabs; text contrast ≥ 4.5:1; colour never the only signal (done = tick + colour; missed = grey dot + label for screen readers); support Dynamic Type up to 1.3× without breaking layouts; reduced motion.
