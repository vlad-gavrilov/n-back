# Exercise parameters and sources

- [Jaeggi et al., 2008 — Improving fluid intelligence with training on working memory](https://pmc.ncbi.nlm.nih.gov/articles/PMC2383929/)
- [Soveri et al., 2017 — Working memory training revisited](https://pubmed.ncbi.nlm.nih.gov/28116702/)
- [Li et al., 2026 — Meta-analysis of computerised working memory training](https://www.nature.com/articles/s41746-026-02478-9)

The standard cycle is 500 ms of visual presentation and 2500 ms of blank field. Responses are accepted throughout the 3000 ms cycle. Each round contains N warm-up trials and 20 scored trials. Six position targets occur per block. Dual blocks contain four position-only targets, four audio-only targets and two shared targets. Their order is shuffled, and all non-target identities are constrained not to create accidental N-back matches.

The 3×3 field uses eight peripheral positions with a central fixation mark. Other field sizes use every cell. The visual marker is circular. Audio uses eight English consonants: B, F, H, J, M, Q, R, W.

The application offers individual rounds, visual-only mode, custom fields, optional live feedback and manually accepted level recommendations. It does not impose the 20-block daily schedule from the 2008 study. These are intentional application-level departures from that protocol.

For each channel, the score is 100 × (hits / targets − false alarms / non-targets). Dual scores average both channels. Mean hit reaction time includes only first valid responses on target trials. No hits produces a null time, displayed as a dash. Warm-up trials are excluded. No-response and all-response strategies both score zero.

The next-level recommendation is +1 when errors (misses + false alarms) are at most two in every channel, −1 when errors are at least six in any channel, otherwise unchanged, bounded to 1–9. The user chooses whether to accept it. Aborted rounds receive no score or recommendation.

Input and stimulus times are measured with a monotonic browser clock. Scheduled boundaries avoid cumulative interval drift. If a stimulus onset arrives more than 250 ms late or an entire stimulus was skipped, the round is interrupted rather than replayed at accelerated speed.
