# Exercise parameters and sources

- [Jaeggi et al., 2008 — Improving fluid intelligence with training on working memory](https://pmc.ncbi.nlm.nih.gov/articles/PMC2383929/)
- [Soveri et al., 2017 — Working memory training revisited](https://pubmed.ncbi.nlm.nih.gov/28116702/)
- [Li et al., 2026 — Meta-analysis of computerised working memory training](https://www.nature.com/articles/s41746-026-02478-9)

The standard cycle is 500 ms of visual presentation followed by a blank field. The full cycle is configurable from 1000 ms to 6000 ms; the research standard of 3000 ms is the default. Responses are accepted throughout the cycle. Each round contains N warm-up trials and 20 scored trials. Six position targets occur per block. Dual blocks contain four position-only targets, four audio-only targets and two shared targets. Their order is shuffled, and all non-target identities are constrained not to create accidental N-back matches.

The 3×3 field uses eight peripheral positions with a central fixation mark. Other field sizes use every cell. The visual marker is circular. Audio uses eight English consonants: B, F, H, J, M, Q, R, W.

The application offers individual rounds, visual-only mode, custom fields, custom stimulus intervals, optional live feedback and manually accepted level recommendations. It does not impose the 20-block daily schedule from the 2008 study. These are intentional application-level departures from that protocol.

For each channel, the score is 100 × (hits / targets − false alarms / non-targets). Dual scores average both channels. The final score is floored at zero. Mean hit reaction time includes only first valid responses on target trials. No hits produces a null time, displayed as a dash. Warm-up trials are excluded. No-response and all-response strategies both score zero.

The next-level recommendation is +1 when errors (misses + false alarms) are at most two in every channel, −1 when errors are at least six in any channel, otherwise unchanged, bounded to 1–9. The user chooses whether to accept it. Aborted rounds receive no score or recommendation.

Input and stimulus times are measured with a monotonic browser clock. Scheduled boundaries avoid cumulative interval drift. The round ends without a score if any scheduled callback runs more than 250 ms late. This covers countdown ticks, stimulus onsets, cue clearing and round completion. The same limit applies to lateness against the nominal trial boundary. A cue still visible at the next boundary also interrupts the round.

If delays in showing and clearing a cue combine, the next cue can start slightly later so the field stays blank for at least 250 ms. This is the shortest configured interval (1000 ms) minus the 500 ms cue and the 250 ms timing tolerance. The original onset schedule still determines whether the delay is acceptable and when later trials are due.

The final response window ends one configured interval after the last stimulus actually appears, including when its onset was slightly delayed. Earlier response windows close at the next nominal onset. If the next stimulus is delayed, its response window opens when it appears.

During an active round, keyboard and pointer responses use the input event's timestamp. A valid timestamp preserves the original trial and reaction time even if the event arrives during a later trial. A zero, negative, non-finite or future timestamp uses the current monotonic time, so the response counts in the window open at delivery. Feedback for a later trial stays available for its own responses. Scoring closes when the round ends.
