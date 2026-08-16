# Samples

Files in this folder were **built by the agents**, not written by hand. They are kept as
evidence, not as maintained examples. Nobody edits them to make them nicer.

Both pages are served live, so you can watch them work without downloading anything:

- [road-not-taken.html](https://mpaiva.github.io/atomic-cockpit/docs/samples/road-not-taken.html)
  — one line every 2 seconds, about 40 seconds in all
- [poem-page.html](https://mpaiva.github.io/atomic-cockpit/docs/samples/poem-page.html)
  — one verse every 10 seconds, about 40 seconds in all

## road-not-taken.html

A single HTML page. It shows one line of a poem every 2 seconds until all twenty lines are up,
then shows the author's signature and stops. It has no controls at all, and makes no network
requests — it works with the internet turned off.

**To see it:** open `road-not-taken.html` in a web browser. Wait about 40 seconds.

**Where it came from.** Someone typed this answer to the question *What do you want to build
today?*:

> a single HTML landing page that reveals one line of a public-domain poem every 2 seconds
> until the whole poem is shown, ending with the author signature

Four agents did the work: one built it, one owned how it looked, one checked it for contrast,
reduced-motion and screen-reader behaviour, and a fourth — which did not take any of their
numbers on trust — tested the finished file in a headless browser at two viewport widths and
found all 9 goals passed. It then re-ran the whole check after the other two had patched the
file, because timing logic is easy to break with an unrelated edit. The full story, with
screenshots, is in [docs/case-study-road-not-taken.md](../case-study-road-not-taken.md).

**The poem.** "The Road Not Taken" by Robert Frost, first published in *Mountain Interval* in
1916. It is in the public domain in the US as a pre-1929 publication. The agents chose it,
checked it was free to use, reproduced all 20 lines unaltered, and cited it on the page —
the citation was one of the mission's success criteria, not an afterthought.

**This file is an exact copy.** It has not been changed since the agents produced it. Its
checksum matches the original: `8d89c307595728ff6e2aed81be3ab183942c0845`.

## poem-page.html

A single HTML page. It shows one verse of a poem every 10 seconds until the poem is complete,
then shows the author's signature and stops.

**Same poem, different run.** Both samples here landed on "The Road Not Taken" — the missions
left the choice of poem to the team, and two separate teams picked the same one. This is the
earlier run: a two-agent team, one verse every 10 seconds, four reveal steps. The other is a
four-agent team, one line every 2 seconds, twenty reveal steps.

They were built independently, three days apart, with no shared code — and they still converged
on the same look: a warm off-white page (`#f6f1e7` here, `#f7f4ee` there) with body text in
exactly the same `#2b2620`. Nobody specified a palette in either mission. Worth knowing before
you read too much into either one as a design decision.

<figure>
  <img src="../media/poem-page-verified.jpg" width="1200"
       alt="The end of the page on a cream background: the last two verses of The Road Not Taken, finishing with 'I took the one less traveled by, And that has made all the difference.' Below a rule, the signature 'Robert Frost, The Road Not Taken, Mountain Interval (1916, public domain)', and a smaller note that the text is a pre-1929 U.S. publication." />
  <figcaption>
    <em>How it ends, photographed from the screen while a person watched the run finish. This
    is the only picture that exists of that run — it was not screen-captured while it
    happened.</em>
  </figcaption>
</figure>

**To see it:** open `poem-page.html` in a web browser. Wait about 40 seconds to see the whole
poem.

**Where it came from.** Someone typed this answer to the question *What do you want to build
today?*:

> a single HTML landing page that reveals one verse of a public-domain poem every 10 seconds
> until the whole poem is shown, ending with the author signature

Two agents did the work. One built the page. A second agent, which did not read the first
one's notes, tested it and found all 8 goals passed.

**The poem.** "The Road Not Taken" by Robert Frost, first published in 1916 in *Mountain
Interval*. It is in the public domain in the United States. The agents chose it, checked that
it was free to use, and named the source on the page.

**This file is an exact copy.** It has not been changed since the agents produced it. Its
checksum matches the original: `90b97e3c899c496f42491cb533fbb12785a7b3b0`.

Runs write to a folder called `build`, which is not saved in this project. This copy is here
so you can see the result without running anything.
