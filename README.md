# Charly the Clown · Run for Fun

This remake contains all 25 numbered stages, the finale and both hidden bonus maps from White Magic's 1996 game. The JavaScript simulation and Canvas 2D renderer use decoded foreground, collision and object records from version 1.30. Jump physics, hazard timing, and some enemy and pickup effects were adapted for the browser engine.

On Windows x64, extract the Windows ZIP and run `Charly the Clown.exe`. The app starts fullscreen with the game filling the window. Press Esc during play to return to the title menu and resume when ready. Press Esc on the title screen to quit. Levels, sound, controls and display mode are on the title screen. F11 also switches to windowed mode.

To run or build the Windows app from source, use `npm ci`, then `npm run windows` or `npm run windows:package`. The package includes its runtime and plays offline. The Windows app renders at Full HD in fullscreen and scales to the current display. Windowed mode follows the window size.

For development, you can also open `dist/index.html` in a current browser. Choose any numbered stage in Levels or play from the beginning and advance via the exits. Hold Jump for a higher jump, crouch in tight passages, and use Down at a hidden entrance. Keyboard and multi-touch controls work offline.

## Android

The source includes a locked Capacitor configuration. With Node.js 22 or newer and Android Studio installed, run these commands in the project folder.

```sh
npm ci
npx cap add android
npm run android:open
```

Select a device or emulator in Android Studio and run the app. After edits in `dist/`, use `npm run android:sync` to copy the game into the Android project.

[Capacitor Android documentation](https://capacitorjs.com/docs/android)

## Project files

- `dist/level-data.js` contains the 28 maps as run-length-encoded tile and collision rows, followed by object records.
- `dist/terrain.js` builds continuous foreground shapes, material fills, masonry, and hazards from the map records.
- `dist/engine.js` handles input state, movement, collisions, enemies, items, and scoring.
- `dist/renderer.js` draws the scene at the screen's pixel density.
- `dist/arcade.js` connects the game to keyboard, touch, audio, and menus.

Run `npm test` for the engine regression checks. They cover every map's data and spawn, Level 1's boxes and high platforms, all three secret entrance and return pairings, cannon direction and invulnerability, crumbling platforms, and complete simulations of Level 1 and LOLLY.

## License

The remake code is licensed under [GPL-3.0-only](LICENSE). The 28 original
layouts and other original-game content are included with publication
permission reported by the maintainer. See [Game content and third-party
notices](CONTENT-NOTICE.md) for the scope of the license and credits.

## Artwork and reference

The title screen, backgrounds, character sprites, material textures, foliage, and enemy and prop art were created with built-in ImageGen. The canvas renderer uses the original geometry records to draw continuous terrain, along with new masonry and spike hazards. Game maps and sprite references come from the original game. [DOS Games Archive](https://www.dosgamesarchive.com/download/charly-the-clown)

The typefaces are Barlow Condensed and DM Sans. Their Open Font License files are included in `dist/assets/`.

<details>
<summary>Illustration prompts</summary>

### Title art `dist/assets/jungle-cover.webp`

Use case: stylized-concept. Generate one widescreen 3:2 cinematic game title-screen background for an art-directed modern browser remake of the 1996 DOS shareware Charly the Clown. Reference image is a gallery: the upper-left frame is the visual reference for the character's exact identity, the other frames are world and palette reference. Paint/render Charly as the same whimsical toy-like circus mascot: round ivory head, distinctly round black sunglasses, bright spherical red nose and red smile, two bright emerald green fluffy side tufts with bald top, red boxing-glove hands, short ivory costume with some royal blue and oversized glossy red shoes. Pose him mid-bounce on a mossy red brick ruin, in a theatrical jungle of dense emerald ferns, blue-purple masonry, brass coins and an eclipse under a vermilion sky. Atmospheric hand-painted / 3D game cover art with lavish detailed textures, bold lighting and a slightly vintage pre-rendered 1990s quality. Composition: all of Charly prominently on the RIGHT 40% of the image with face around x=72%, y=42%; dark purple-red foliage on the LEFT half for website text overlay, quieter low contrast and very dark left third. Dark foreground bottom, filmic silhouette shapes on the periphery. A cropped independent cover image, no UI, no lettering, no words, no frame, no watermark.

### Parallax `dist/assets/jungle.webp`

Use case: stylized-concept. One borderless widescreen 3:2 background texture for a modern 2D side-scrolling arcade platformer remake of the first jungle stage in Charly the Clown (1996). This is the DISTANT parallax layer visible behind gameplay. Palette: beautifully rich muted wine-purple darkness under a red orange eclipse sunset, silhouetted dense jungle canopy and distant broad mesas with ruined blue slate brick towers behind trees. Put the eclipse high near center-left surrounded by soft red sky. Layered and panoramic, at the height of the trees viewed side-on with no steep perspective. Lower 2/3 is dark atmospheric desaturated green/blue jungle treetops, saturated sky at top. Subtle dramatic amber rim lighting, evocative 2.5D video game painted render with atmospheric shading and fine texture. Dark enough to read bright golden coins and foreground props. No character, no writing, no platforms, no coins, no HUD. Both horizontal edges show similarly dark tree tops and sky so it can pan gently.

### Player `dist/assets/charly-*.webp`

Use case: stylized-concept. Make a game sprite sheet of exactly four different poses of the 1996 DOS game character Charly the Clown, in one evenly spaced row of four separate sprite cells, rendered as a modern high-res 3D toy figure with the same design as the provided title art. Transparent genuine alpha. Cells have equal widths and do not overlap; every body completely visible with generous clear margin. Each is facing screen RIGHT in 3/4 profile, side-scrolling platformer. Pose in each cell left to right: ready idle with feet on ground and boxing gloves raised slightly; running with rightmost foot reaching forward; jumping airborne with knees and gloves tucked in; ducking in a low crouch. Same scale, same eye height in first two, roughly centered in each cell. Identical character design throughout: round ivory face, round black sunglasses, spherical bright red nose and smile, green fluffy side curls, red boxing glove hands, short toy legs, ivory shirt with circular blue emblem, blue pants, large glossy red clown shoes. Stately, dimensional Pixar-like toy plastics with warm amber rim light. No ground shadow, background, scenery, additional objects, lettering, frames, or UI. Wide horizontal layout.

### Cliffs `dist/assets/cliff.webp` and `dist/assets/moss.webp`

Use case: stylized-concept. An environment sprite atlas for a modern 2.5D side scrolling jungle platformer. One landscape image comprised of two equal-height horizontal strips of texture across the full width, share same rock scale. Upper strip: cross-section of mossy red-brown irregular chunky cliff rocks and old stone bricks, dark desaturated burgundy and warm russet rock strata, crevices and fine surface detail with gentle warm upper-left lighting, perfectly front-facing, completely filled. Lower strip: ornate grassy moss top lip at its very top featuring trailing rich emerald vegetation and occasional star-like red and yellow tiny flowers, with angular rusty stone cross-section under the moss, consistent straight horizontal shelf and bottom edge, filled to the edges. Stylish hand-painted realistic game texture, real material roughness, deep purple shadow, 1990s platform game level reimagined with today's richly rendered art direction. No UI, no words, no columns, no objects sticking out of the top strip, no frame, no objects other than vines and embedded rock. Landscape 3:2.

### Tree `dist/assets/tree.webp`

Use case: stylized-concept. Create one transparent sprite for a modern richly rendered side-scrolling arcade jungle game, a complete single broad-topped tree. True transparent background. Viewed perfectly side-on at trunk eye height, an umbrella shaped lush emerald tropical canopy with several layered clusters of small broad pointed jungle leaves and moss, a textured wide reddish-brown exposed trunk and roots. Silhouette has no branches sticking way out left or right. The rounded deep green canopy is roughly 60 percent of the sprite height. Glossy natural green with some reddish sunset rim light, painterly realistic game art, polished modern 2.5D pre-rendered videogame look, full tree from apex to base with transparent margin. No other sprite, horizon, floor, grass, background, writing or shadow. Landscape or square framing.

### Enemies `dist/assets/bat.webp` and `dist/assets/crawler.webp`

Use case: stylized-concept. Transparent game creature sprite atlas for a modern hand-painted / 3D side-scrolling platformer with emerald jungle and blazing eclipse. TWO distinct separate creatures in one row of two equally spaced cells with generous true alpha transparent margins, no overlap. Left cell: small whimsical sinister brown cave bat facing the viewer, outstretched copper-brown pointed wings with tan rim lighting, a tiny dark body, silver ivory round eyes and two white fangs, clearly readable silhouette. Right cell: colorful small caterpillar facing left in 3/4 side view, three emerald green segmented round shiny shell parts and turquoise-blue face with large white cartoon eyes. Both use tactile 3D stylized toy materials, craggy visual details but strong silhouettes, amber lighting, matching style, full bodies. No lettering, no ground, no shadows, no background, no boxes.

### Snow backdrop `dist/assets/vista-7.webp`

Use case: stylized-concept. Widescreen panoramic image, distant parallax background for an upscale faithful remake of the snow levels of 1996 platformer Charly the Clown. Show high snow-covered mountain ridges, icy evergreen jungle and ruined little blue stone battlements silhouetted far away, backlit by a deep indigo moonlit sky with a faint aurora and fine stars. Blue, lavender and teal shadows, soft warm pink light kissing some snowy edges. Match the richly rendered hand-painted 2.5D game environment of the provided jungle cover and background. Foreground objects stand out against the softer medium-dark mountain folds. Maintain wide composition with features layered horizontally at varying distances and upper 40% of image occupied by sky. No characters, front platforms, lettering, icons, borders, frames, or UI.

### Arcade ruins `dist/assets/vista-5.webp` and `dist/assets/vista-6.webp`

Use case: stylized-concept. Wide parallax background for a modern upscale side-scrolling platformer. A row of abandoned small stone arcade factory buildings in an overgrown demilitarized fantasy jungle, weathered blocky gray stone facades, shuttered windows, climbing vines, broad-canopied trees and distant gothic blue-red brick ruins. Twilight sky in deep brick red, lavender shadows, warm amber details, slate-violet stone, dark green plants. Front-on 2.5D side-scroller art with layered depth. Present a quiet distant environment behind gameplay, buildings emerging from dark foliage in lower half, no foreground platform the player could mistake for solid terrain. Match richly rendered hand-painted look and lighting from provided jungle. No people, no foreground sprites, no readable signage, no text, no eyes, no user interface.

</details>



<details>
<summary>Graphics overhaul prompts (built-in ImageGen)</summary>

**Materials**

Production game asset, a 3x2 material contact sheet for a modern premium 2.5D jungle platformer. Precisely regular grid, six contiguous equal rectangular cells, fill them completely edge to edge, no border or gutter or labels. Each cell is a different FRONT-FACING flat high resolution uniform material under the same softly directional cinematic warm left light. Top row left to right: rugged warm dark purple-brown jungle basalt with fine angular fractured surfaces; dark royal blue slate stone with subtle purple warm rim in the grain; deep reddish terracotta stone with subtle grain. Bottom row left to right: cool desaturated steel grey granite with subtle finely granular surface; rich green wet rainforest moss ground captured face on, subtle amber leaves; icy blue frost-covered rock with soft snow crystal details. Fine material detail, visually cohesive stylized realistic game sculpt, saturated but never neon. No scenery, perspective, planks, wall courses, characters, dividing lines or objects. The game engine adds masonry outlines and edges. Landscape 3:2.

**Scenery**

Transparent background asset sheet for a polished painted 3D jungle side-scrolling platformer, exactly a regular 3 columns by 2 rows grid six isolated complete scenery assets centered in each cell with a 10% transparent cell margin, no overlap. Top row: a healthy round-canopied forest tree with sturdy twisted trunk and deep emerald broad leaves; another shorter dense jungle tree with golden rim on forest green leaves; a blue spruce with weighty patches of snow, trunk and full pointed tip. Bottom row: compact clump of three layered emerald jungle ferns; cluster of two orange red round mushrooms and tiny mossy mound; fan of tropical banana leaves on a low stem. Side-on orthographic cutouts, main silhouettes bold and clear, subtle warm/coral edge light and resin-like rich 3D materials, hand-painted AAA 2.5D game finish. Roots and tips fully visible. True transparent alpha and no cast floor shadows. No letters or grid marks.

**Sprites**

True transparent sprite atlas for an upscale 3D rendered retro platformer. Exactly four columns by three rows, 12 isolated objects, centered each in a mathematically regular grid with wide transparent margins around every cell and full silhouette, 3/4 side-view, objects face RIGHT, akin shiny detailed sculpted retro toy with cinematic warm key light. Row 1 left to right: lime green anthropomorphic three-armed saguaro cactus with white little needles and red brown shoes walking; spooky off-white ghost with black eyeholes and round red clown nose hovering in wisps; dark iron cartoon bomb walking in red boots with a lit fuse and nose; squat dark iron cannon pointing right with scarlet wheels and cartoon eyes. Row 2: an amber honeybee with clear wings; round rough ochre boulder; blue and red single prop toy airplane pointed right; vertical handblown blue potion vial gold cap. Row 3: glistening large crimson diamond-cut ruby; sturdy wooden log section seen sideways with polished amber cut ends; gold wound spring with red upper footplate; small graphite cannonball with a crisp metal highlight, round. Objects only, true alpha transparency, no ground, no cast shadows, no interface, no text. Premium finely detailed materials and crisp edges at 1080p, overall warm mellow amber and violet-black tonal range.

**Village backdrop**

Create a widescreen 16:9 panoramic parallax background for the village level of a 3D painted jungle platformer. Scene in the far distance: dense huge tropical canopy, craggy winding escarpments, sparse abandoned blue-grey stone ruins disappearing into the jungle and a red-orange eclipse sky. The magenta dusk haze and exceptionally warm amber rim lights match a theatrical fantasy jungle. Set the horizon around the lower third. Layered atmospheric perspective; distant landscape softened to support crisp gameplay and silhouettes in a separately rendered foreground. Natural high quality game illustration, no platforms, no characters, no text. Edge-to-edge clean composition.

</details>

### Animation and rendering

The Windows fullscreen game targets a Full HD backing canvas. The terrain renderer caches pre-rendered map sections, including foreground traps, masonry and background scenery. The parallax backdrop is composited as a separate display layer.

Charly, the cactus and the bomb use travel-driven gait cycles. The bat and bee use wing poses. Rolling objects follow their horizontal displacement, and the cannon, spring and wood use their gameplay state for their motion.

<details>
<summary>Animation prompts (built-in ImageGen)</summary>

**charly**

Animation sprite sheet for a 2.5D platform game. Use the attachment as the exact model for Charly: ivory spherical ceramic head, bright green side hair, black sunglasses, round red nose, blue overalls, red gloves and shoes. Match the material, proportions, lighting and three-quarter right-facing profile exactly. Make a regular grid of three columns and two rows, all six cells the same size, one complete Charly per cell with a 12% transparent margin and identical ground baseline, camera and scale. The sequence is a real sustained run cycle, the first 3 frames right-foot contact forward, right-foot support under hip as the left knee passes forward, then extended airborne push-off. Second 3 alternate contact left foot forward and right backwards, left-foot support under hip while right knee passes forward, then alternate airborne push-off. Both legs visible, arms swing reciprocally, follow the attached toy geometry and do not change the size of head, eyes or feet across the sheet. Ordered top-left to bottom-right. True transparent alpha, no ground plane, no shadows on background, no text or grid. Each pose must fit its own cell completely.

**walk**

Create a production two-character animation atlas based precisely on the reference character designs: top row the green saguaro with red-brown boots, bottom row the iron bomb character with a lit fuse and scarlet nose. Four precisely evenly spaced columns and two equal rows with transparent gutters all around each character. Each row is a distinct 4-frame walk cycle facing 3/4 right: right boot forward/left back, passing with feet below body, left boot forward/right back, other passing pose. Visible true articulation in legs and separated red shoe silhouettes. Same camera and model proportions in all frames of each row, common ground baseline, match the uploaded amber studio lighting and sculpted toy materials. No labels, grid or floor. True transparent background, no cast shadows on background. All eight full characters independently inside their equal-sized cells.

**flight**

Production animated sprite atlas using the attached brown bat and golden honeybee exactly as model and lighting references. Regular 3 columns x 2 rows of equal-sized cells, true transparent alpha, very generous gutters. Top row is front-on bat, all three poses same body, head angle and foot position, with actual wing joint changes: wings up in a V, wings fully extended horizontally, wings swooping down to a shallow inverted V. Brown copper bat wings membrane stays attached to shoulders. Bottom row three-quarter right-facing bee, same fluffy gold and dark abdomen and large eyes, same orientation and body position: clear wings lifted together behind head, fully spread outward, folded back and low. Full wings must fit inside their cells. The bodies keep equal proportions across each row, warm amber 3D toy game look. No shadows on background, no annotations or ground.

Transparent video game sprite cutouts, no background at all. Two rows, THREE clearly separated equal square cells per row, wide gutters. Top row individually isolated front-on copper brown cartoon bat wings UP, bat wings horizontal, bat wings DOWN, same head and body dimensions and position in each frame. Bottom row side-on golden fuzzy bumblebee facing right with milk-glass wings lifted, wings spread, wings dropped/back, same body position and dimensions. 3D carved collectible toy appearance with amber light, extremely clean outer edges. Entirely transparent in all spaces outside the six silhouettes. Remove the floor, environment, atmosphere, shadow and all colors outside the silhouettes. Preserve complete wing tips. Use a real alpha channel. No lines or labels.

</details>

<details>
<summary>Scenery corrections (built-in ImageGen)</summary>

**Boulder pile**

Transparent background game asset for a stylized 3D jungle platformer. A single low wide pile of rounded and semi-angular slate and granite boulders of different sizes, low irregular silhouette about 2.7 times as wide as tall. Larger stones clustered a little left of center, smaller stones falling away toward each side, fitted naturally with a nearly level ground contact and some shadowed gaps between stones. Color subdued deep plum gray, graphite and slate, with a restrained warm orange rim light from top left and cooler violet contact shadows. Clear individual stone forms at small display sizes, finely textured sculpted surfaces and a handful of sparse dark green moss spots on the rocks at the base. Fully isolated artwork on real transparent alpha, no scenery, no floors, no loose stones outside the connected pile, no grid, no rectangular slab, no blocks, no letters. Show the entire rock pile with clear padding on each side. Front-facing side-scroller scenery viewed nearly straight-on, warm hand-finished sculpted fantasy look.

**Tree stump**

Isolated transparent game sprite of a short cut brown tree stump with spreading roots, for a warm stylized 3D jungle platformer. Straight side view, slightly enough above to see the elliptical cut top. Low squat proportions, wider root silhouette than its vertical height. Flat believable golden wood grain cut surface with subtle growth rings, bark split into deep umber and amber ridges, rich carved organic details, roots taper gently left and right to a level ground contact. Crown edge reads as a clear horizontal surface in a side-scrolling game. Real transparent alpha, no background, no ground plane, no cast shadow outside the silhouette, no surroundings or loose items, no moss on the top, no text. Warm amber sunlight from upper left, cooler plum in shadows, same collectible toy-like detailed sculpt quality as a premium 2.5D game prop.

</details>
