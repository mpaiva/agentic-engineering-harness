# Samples

Files in this folder were **built by the agents**, not written by hand. They are kept as
evidence, not as maintained examples. Nobody edits them to make them nicer.

Both pages are served live, so you can watch them work without downloading anything:

- [ozymandias.html](https://mpaiva.github.io/atomic-cockpit/docs/samples/ozymandias.html)
  — one line every 2 seconds, about 30 seconds in all
- [poem-page.html](https://mpaiva.github.io/atomic-cockpit/docs/samples/poem-page.html)
  — one verse every 10 seconds, about 40 seconds in all

## ozymandias.html

A single HTML page. It shows one line of a poem every 2 seconds until all fourteen lines are
up, then shows the author's signature and stops. There is a Pause button while it is running;
it hides itself when there is nothing left to pause.

**To see it:** open `ozymandias.html` in a web browser. Wait about 30 seconds.

**Where it came from.** Someone typed this answer to the question *What do you want to build
today?*:

> a single HTML landing page that reveals one line of a public-domain poem every 2 seconds
> until the whole poem is shown, ending with the author signature

Four agents did the work: one built it, one owned how it looked, one checked it against WCAG
2.2, and a fourth — which did not read any of their notes — tested the finished file in a
headless browser and found all 7 goals passed. The full story, with screenshots, is in
[docs/case-study-ozymandias.md](../case-study-ozymandias.md).

**The poem.** "Ozymandias" by Percy Bysshe Shelley, first published in 1818. It is in the
public domain. The agents chose it, checked it was free to use, and reproduced all 14 lines
unaltered.

**This file is an exact copy.** It has not been changed since the agents produced it. Its
checksum matches the original: `49facb384e65c7bd26c29f1e9ae1d10cba06d255`.

## poem-page.html

A single HTML page. It shows one verse of a poem every 10 seconds until the poem is complete,
then shows the author's signature and stops.

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
