# Species photo audit

Audit log for the species photos in `species-photos/` (sprites `p*.jpg`, tiles `t/<sheet>-<n>.webp`) and their credits in the `#photo-index` JSON of `snakelist-synced.html`. Replacements go through `tools/import_photo_batch.py` (cover-crop to the 540x360 tile, never stretched; credit, licence and source stored in `#photo-index`).

## 2026-11-24 pass

### Coverage

- Every species photo in the index was looked at once on labelled contact sheets (all 3099 real photos, 35 per sheet, most famous species first; the 174 SnakeList illustrations of fossil species were not part of this review). Flagged photos were re-checked at full tile size.
- 253 photos were flagged (list below). 78 photos were replaced in this pass: 21 because the photo itself was unsuitable (gape, feeding, objects, rubbish, container) or poorly composed (tiny or hidden snake), 18 of which were also NC, and 57 famous species whose photo was fine but CC BY-NC.
- Candidates came from research-grade, non-captive iNaturalist observations whose photo licence is CC0, CC BY or CC BY-SA, sorted by community votes. Each chosen photo was viewed before import and its observation taxon checked against the SnakeList species (subspecies of the same species accepted; lookalike species, captive animals, held snakes, feeding scenes and gapes rejected). Where no candidate was clearly at least as good, the old photo was kept.

### Licences (after this pass)

Photos must allow website use with advertising and paid features: CC0, CC BY and CC BY-SA are fine; anything NC is not.

| licence | photos |
|---|---|
| CC BY-NC | 2389 |
| CC BY | 453 |
| Illustration | 174 |
| CC0 | 98 |
| CC BY-SA | 81 |
| CC BY-NC-SA | 69 |
| CC BY 4.0 | 3 |
| CC BY-SA 4.0 | 2 |
| other | 2 |
| CC BY-SA 2.0 | 1 |
| CC BY-SA 3.0 | 1 |

**2458 of 3099 real photos (79%) are still non-commercial (CC BY-NC or CC BY-NC-SA)** and need replacing or explicit permission from the photographers before ads or paid features run alongside them. Two photos have no CC licence in their credit (`tetracheilostoma-carlae`, credited "S. Blair Hedges"; `natriciteres-bipostocularis`, "Photo sent to SnakeList") and need their permission documented.

Most famous species still on an NC photo (the top 40 by fame score):

`natrix-natrix`, `boa-constrictor`, `agkistrodon-contortrix`, `lampropeltis-triangulum`, `echis-carinatus`, `python-bivittatus`, `python-regius`, `hydrophis-platurus`, `lampropeltis-californiae`, `oxyuranus-microlepidotus`, `dendroaspis-angusticeps`, `naja-kaouthia`, `nerodia-rhombifer`, `eryx-colubrinus`, `vipera-berus`, `natrix-tessellata`, `daboia-russelii`, `malpolon-monspessulanus`, `nerodia-sipedon`, `amphiesma-stolatum`, `laticauda-colubrina`, `bothrops-atrox`, `chrysopelea-ornata`, `masticophis-flagellum`, `elaphe-quatuorlineata`, `nerodia-fasciata`, `bungarus-fasciatus`, `pseudechis-australis`, `lycodon-aulicus`, `dendroaspis-viridis`, `thamnophis-marcianus`, `trimeresurus-stejnegeri`, `elaphe-climacophora`, `rhinocheilus-lecontei`, `pantherophis-emoryi`, `thamnophis-cyrtopsis`, `telescopus-fallax`, `thamnophis-ordinoides`, `zamenis-situla`, `elaphe-carinata`

### Replacements

| species | reason | new photo | licence | source |
|---|---|---|---|---|
| *Lampropeltis getula* | old photo: kingsnake wrapped around/eating another snake (feeding scene) | Matthew Lumsden (iNat obs. [346711606](https://www.inaturalist.org/observations/346711606)) | CC BY | [photo](https://www.inaturalist.org/photos/632045787) |
| *Cerastes vipera* | old photo: defensive open-mouth gape; also NC | Sara Navarro (iNat obs. [347047603](https://www.inaturalist.org/observations/347047603)) | CC BY | [photo](https://www.inaturalist.org/photos/632713274) |
| *Xenodon merremii* | old photo: defensive open-mouth gape; also NC | Hugo Hulsberg (iNat obs. [63591005](https://www.inaturalist.org/observations/63591005)) | CC0 | [photo](https://www.inaturalist.org/photos/102082294) |
| *Elaphe sauromates* | old photo: defensive open-mouth gape | Andrew Bazdyrev (iNat obs. [48922064](https://www.inaturalist.org/observations/48922064)) | CC BY | [photo](https://www.inaturalist.org/photos/77614952) |
| *Oligodon octolineatus* | old photo: tape measure in frame; also NC | Bernard DUPONT (iNat obs. [86179611](https://www.inaturalist.org/observations/86179611)) | CC BY | [photo](https://www.inaturalist.org/photos/141926996) |
| *Atheris nitschei* | old photo: open-mouth gape; also NC | Elliot Greiner (iNat obs. [245902610](https://www.inaturalist.org/observations/245902610)) | CC BY | [photo](https://www.inaturalist.org/photos/438888770) |
| *Liotyphlops ternetzii* | old photo: snake in a white container | Tomás Carranza Perales (iNat obs. [120913121](https://www.inaturalist.org/observations/120913121)) | CC BY | [photo](https://www.inaturalist.org/photos/204557673) |
| *Bothrophthalmus lineatus* | old photo: plastic rubbish around the snake, head obscured; also NC | Marius Burger (iNat obs. [350364555](https://www.inaturalist.org/observations/350364555)) | CC0 | [photo](https://www.inaturalist.org/photos/639255035) |
| *Leptophis coeruleodorsus* | old photo: open-mouth gape with a bag in frame; also NC | Savita (iNat obs. [27912269](https://www.inaturalist.org/observations/27912269)) | CC0 | [photo](https://www.inaturalist.org/photos/43474880) |
| *Sinomicrurus swinhoei* | old photo: coin placed next to the snake; also NC | Jay Paroline (iNat obs. [365467466](https://www.inaturalist.org/observations/365467466)) | CC BY | [photo](https://www.inaturalist.org/photos/667573177) |
| *Ophiophagus hannah* | old photo small in frame and CC BY-NC; clear hooded adult | Max Tibby (iNat obs. [409096686](https://www.inaturalist.org/observations/409096686)) | CC0 | [photo](https://www.inaturalist.org/photos/752123899) |
| *Naja naja* | licence: old photo CC BY-NC; sharp hooded adult showing spectacle mark | Chayant Gonsalves (iNat obs. [84964394](https://www.inaturalist.org/observations/84964394)) | CC BY | [photo](https://www.inaturalist.org/photos/139716904) |
| *Malayopython reticulatus* | licence: old photo CC BY-NC; sharp head and pattern | Noah Kirkland (iNat obs. [198973584](https://www.inaturalist.org/observations/198973584)) | CC BY | [photo](https://www.inaturalist.org/photos/350803836) |
| *Pantherophis guttatus* | old photo small on concrete and CC BY-NC; typical blotched adult in vegetation (Florida) | chloe ⋆˚꩜｡ (iNat obs. [71489463](https://www.inaturalist.org/observations/71489463)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/116402190) |
| *Dendroaspis polylepis* | licence: old photo CC BY-NC; whole snake with head, natural perch | Marius Burger (iNat obs. [112196463](https://www.inaturalist.org/observations/112196463)) | CC0 | [photo](https://www.inaturalist.org/photos/189495916) |
| *Crotalus adamanteus* | licence: old photo CC BY-NC; sharp coiled adult | evangrimes (iNat obs. [55558483](https://www.inaturalist.org/observations/55558483)) | CC BY | [photo](https://www.inaturalist.org/photos/88475195) |
| *Crotalus horridus* | licence: old photo CC BY-NC; coiled adult on rock in forest | Ann McKenzie (iNat obs. [254850411](https://www.inaturalist.org/observations/254850411)) | CC0 | [photo](https://www.inaturalist.org/photos/456568149) |
| *Dispholidus typus* | licence: old photo CC BY-NC; sharp head and body in vegetation | Wynand Uys (iNat obs. [10824528](https://www.inaturalist.org/observations/10824528)) | CC BY | [photo](https://www.inaturalist.org/photos/15165535) |
| *Morelia spilota* | licence: old photo CC BY-NC; coiled adult (jungle carpet python form) in leaf litter | Graham Winterflood (iNat obs. [303656924](https://www.inaturalist.org/observations/303656924)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/547333631) |
| *Crotalus viridis* | licence: old photo CC BY-NC; coiled adult, head and rattle visible | Scott Shupe (iNat obs. [195067985](https://www.inaturalist.org/observations/195067985)) | CC0 | [photo](https://www.inaturalist.org/photos/343072081) |
| *Crotalus scutulatus* | licence: old photo CC BY-NC; sharp coiled adult | Jeremiah Degenhardt (iNat obs. [128094446](https://www.inaturalist.org/observations/128094446)) | CC BY | [photo](https://www.inaturalist.org/photos/217539324) |
| *Opheodrys vernalis* | licence: old photo CC BY-NC; sharp head and body in natural setting | Dustin Snider (iNat obs. [223024689](https://www.inaturalist.org/observations/223024689)) | CC BY | [photo](https://www.inaturalist.org/photos/395128293) |
| *Eunectes notaeus* | licence: old photo CC BY-NC; head and body clear | tlaloc27 (iNat obs. [7049686](https://www.inaturalist.org/observations/7049686)) | CC BY | [photo](https://www.inaturalist.org/photos/9048203) |
| *Lachesis muta* | licence: old photo CC BY-NC; sharp coiled adult, head visible | ....Christopher Borges.... (iNat obs. [145914614](https://www.inaturalist.org/observations/145914614)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/250740871) |
| *Micrurus fulvius* | licence: old photo CC BY-NC; whole snake, head visible | Court Harding (iNat obs. [79056059](https://www.inaturalist.org/observations/79056059)) | CC BY | [photo](https://www.inaturalist.org/photos/129453784) |
| *Corallus caninus* | licence: old photo CC BY-NC; classic coiled pose on branch | Whaldener Endo (iNat obs. [145235414](https://www.inaturalist.org/observations/145235414)) | CC0 | [photo](https://www.inaturalist.org/photos/249447353) |
| *Heterodon nasicus* | licence: old photo CC BY-NC; sharp coiled adult on sand | Dean Hester (iNat obs. [17815453](https://www.inaturalist.org/observations/17815453)) | CC BY | [photo](https://www.inaturalist.org/photos/27187755) |
| *Morelia viridis* | licence: old photo CC BY-NC; sharp head and coils | Bryce Watts-Parker (iNat obs. [244043246](https://www.inaturalist.org/observations/244043246)) | CC BY | [photo](https://www.inaturalist.org/photos/435259669) |
| *Oxyuranus scutellatus* | licence: old photo CC BY-NC; sharp head and forebody in leaf litter | Jun MATSUI (iNat obs. [254457213](https://www.inaturalist.org/observations/254457213)) | CC0 | [photo](https://www.inaturalist.org/photos/455786066) |
| *Sistrurus catenatus* | licence: old photo CC BY-NC; coiled adult in habitat | Court Harding (iNat obs. [94612756](https://www.inaturalist.org/observations/94612756)) | CC BY | [photo](https://www.inaturalist.org/photos/156967313) |
| *Lichanura trivirgata* | licence: old photo CC BY-NC; sharp striped adult on rock | Melanie J. Davis (iNat obs. [219259752](https://www.inaturalist.org/observations/219259752)) | CC BY | [photo](https://www.inaturalist.org/photos/388075658) |
| *Python brongersmai* | licence: old photo CC BY-NC; sharp adult, head visible | Ian Dugdale (iNat obs. [301466716](https://www.inaturalist.org/observations/301466716)) | CC BY | [photo](https://www.inaturalist.org/photos/543230533) |
| *Bitis rhinoceros* | licence: old photo CC BY-NC; head with nasal horns and body pattern | Marius Burger (iNat obs. [350372376](https://www.inaturalist.org/observations/350372376)) | CC0 | [photo](https://www.inaturalist.org/photos/639268824) |
| *Coronella austriaca* | licence: old photo CC BY-NC; sharp coiled adult on rock | Adam Golenia (iNat obs. [407584809](https://www.inaturalist.org/observations/407584809)) | CC BY | [photo](https://www.inaturalist.org/photos/749032400) |
| *Coluber constrictor* | licence: old photo CC BY-NC; sharp head and forebody of black adult (nominate form) | Ken-ichi Ueda (iNat obs. [291067](https://www.inaturalist.org/observations/291067)) | CC BY | [photo](https://www.inaturalist.org/photos/360292) |
| *Pantherophis obsoletus* | licence: old photo CC BY-NC; sharp head and body of black adult | Chrissy McClarren and Andy Reago (iNat obs. [318564665](https://www.inaturalist.org/observations/318564665)) | CC0 | [photo](https://www.inaturalist.org/photos/575764844) |
| *Hierophis viridiflavus* | licence: old photo CC BY-NC; sharp adult, head and pattern visible | Gabriele Vaudano (iNat obs. [85922972](https://www.inaturalist.org/observations/85922972)) | CC BY | [photo](https://www.inaturalist.org/photos/141457981) |
| *Notechis scutatus* | licence: old photo CC BY-NC; sharp head and banded body | Joey Santore (iNat obs. [34052700](https://www.inaturalist.org/observations/34052700)) | CC BY | [photo](https://www.inaturalist.org/photos/53547866) |
| *Ptyas mucosa* | licence: old photo CC BY-NC; adult on branch, sharp | Surabhi Srivastava (iNat obs. [212098553](https://www.inaturalist.org/observations/212098553)) | CC BY | [photo](https://www.inaturalist.org/photos/374811040) |
| *Ahaetulla prasina* | old photo: snake tiny among branches, and CC BY-NC; whole snake on branch (yellow colour form) | Ioannis Magouras (iNat obs. [238118060](https://www.inaturalist.org/observations/238118060)) | CC BY | [photo](https://www.inaturalist.org/photos/423877495) |
| *Naja nivea* | licence: old photo CC BY-NC; sharp hooded adult in habitat | Ryan van Huyssteen (iNat obs. [186192093](https://www.inaturalist.org/observations/186192093)) | CC BY | [photo](https://www.inaturalist.org/photos/325326142) |
| *Charina bottae* | licence: old photo CC BY-NC; sharp coiled adult, head visible | andrewnydam (iNat obs. [112848703](https://www.inaturalist.org/observations/112848703)) | CC BY | [photo](https://www.inaturalist.org/photos/190641848) |
| *Bungarus multicinctus* | old photo head at edge with object in frame, and CC BY-NC; whole coiled snake in leaf litter | 尹若宇 (iNat obs. [19650103](https://www.inaturalist.org/observations/19650103)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/30260602) |
| *Storeria dekayi* | old photo snake tiny in frame, and CC BY-NC; sharp coiled adult | Michael J. Papay (iNat obs. [237149933](https://www.inaturalist.org/observations/237149933)) | CC BY | [photo](https://www.inaturalist.org/photos/422007190) |
| *Heterodon platirhinos* | licence: old photo CC BY-NC; sharp head and body | evangrimes (iNat obs. [117505952](https://www.inaturalist.org/observations/117505952)) | CC BY | [photo](https://www.inaturalist.org/photos/198456535) |
| *Opheodrys aestivus* | old photo head hidden behind twigs, and CC BY-NC; sharp head and forebody | Judy Gallagher (iNat obs. [183174615](https://www.inaturalist.org/observations/183174615)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/319528599) |
| *Crotalus durissus* | licence: old photo CC BY-NC; coiled adult in habitat | Salomão Janderson Ferreira Bispo (iNat obs. [184945615](https://www.inaturalist.org/observations/184945615)) | CC BY | [photo](https://www.inaturalist.org/photos/322908688) |
| *Boiga irregularis* | licence: old photo CC BY-NC; whole coiled adult, head visible | Carey_Knox_Southern_Scales (iNat obs. [406501479](https://www.inaturalist.org/observations/406501479)) | CC0 | [photo](https://www.inaturalist.org/photos/746856086) |
| *Hemorrhois hippocrepis* | old photo snake obstructed by vegetation, and CC BY-NC; sharp head and body | Lucas Benaiche (iNat obs. [331668066](https://www.inaturalist.org/observations/331668066)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/601724886) |
| *Aspidites melanocephalus* | licence: old photo CC BY-NC; adult in red-soil habitat, black head visible | Connor Margetts (iNat obs. [159692451](https://www.inaturalist.org/observations/159692451)) | CC BY | [photo](https://www.inaturalist.org/photos/275918918) |
| *Pseudechis porphyriacus* | licence: old photo CC BY-NC; sharp head showing red flanks | Richard Fuller (iNat obs. [49177561](https://www.inaturalist.org/observations/49177561)) | CC0 | [photo](https://www.inaturalist.org/photos/78061047) |
| *Thamnophis elegans* | licence: old photo CC BY-NC; sharp coiled adult | wordjourneys (iNat obs. [96641720](https://www.inaturalist.org/observations/96641720)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/160580546) |
| *Naja atra* | licence: old photo CC BY-NC; hooded adult showing hood marking | 葉子 (iNat obs. [127075148](https://www.inaturalist.org/observations/127075148)) | CC0 | [photo](https://www.inaturalist.org/photos/215692333) |
| *Xenopeltis unicolor* | licence: old photo CC BY-NC; whole adult showing iridescence | ssismsscience (iNat obs. [20290971](https://www.inaturalist.org/observations/20290971)) | CC0 | [photo](https://www.inaturalist.org/photos/31324622) |
| *Thamnophis proximus* | licence: old photo CC BY-NC; sharp coiled adult, head visible | Sam Kieschnick (iNat obs. [2756495](https://www.inaturalist.org/observations/2756495)) | CC BY | [photo](https://www.inaturalist.org/photos/3117659) |
| *Bothrops jararaca* | licence: old photo CC BY-NC; coiled adult, pattern clear | Ibere Machado (iNat obs. [315925096](https://www.inaturalist.org/observations/315925096)) | CC BY | [photo](https://www.inaturalist.org/photos/570748879) |
| *Trimeresurus albolabris* | licence: old photo CC BY-NC; sharp coiled adult | Ioannis Magouras (iNat obs. [187629299](https://www.inaturalist.org/observations/187629299)) | CC BY | [photo](https://www.inaturalist.org/photos/328170201) |
| *Natrix helvetica* | licence: old photo CC BY-NC; sharp coiled adult on moss | Sylvain Montagner (iNat obs. [200837556](https://www.inaturalist.org/observations/200837556)) | CC BY | [photo](https://www.inaturalist.org/photos/354414233) |
| *Dasypeltis scabra* | licence: old photo CC BY-NC; sharp coiled adult, head visible | Wynand Uys (iNat obs. [37219749](https://www.inaturalist.org/observations/37219749)) | CC BY | [photo](https://www.inaturalist.org/photos/58969087) |
| *Micrurus tener* | licence: old photo CC BY-NC; whole adult in grass | Nick Loveland (iNat obs. [22103893](https://www.inaturalist.org/observations/22103893)) | CC0 | [photo](https://www.inaturalist.org/photos/34216906) |
| *Elaphe dione* | licence: old photo CC BY-NC; sharp coiled adult | Zinogre (iNat obs. [140744748](https://www.inaturalist.org/observations/140744748)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/240963459) |
| *Antaresia childreni* | licence: old photo CC BY-NC; sharp coiled adult | dhfischer (iNat obs. [56206772](https://www.inaturalist.org/observations/56206772)) | CC BY | [photo](https://www.inaturalist.org/photos/89556328) |
| *Vipera latastei* | licence: old photo CC BY-NC; sharp head and zigzag pattern | Marco Sommer (iNat obs. [261971181](https://www.inaturalist.org/observations/261971181)) | CC BY | [photo](https://www.inaturalist.org/photos/470737414) |
| *Oxybelis fulgidus* | licence: old photo CC BY-NC; head and forebody in habitat | Ricard Busquets Reverte (iNat obs. [71669893](https://www.inaturalist.org/observations/71669893)) | CC BY | [photo](https://www.inaturalist.org/photos/116719977) |
| *Python sebae* | old photo snake obstructed behind bamboo, and CC BY-NC; whole coiled adult in grass | Lucy Keith-Diagne (iNat obs. [62068928](https://www.inaturalist.org/observations/62068928)) | CC BY | [photo](https://www.inaturalist.org/photos/99400002) |
| *Vipera seoanei* | licence: old photo CC BY-NC; sharp whole adult on stones | Michael Bakker Paiva (iNat obs. [152737503](https://www.inaturalist.org/observations/152737503)) | CC BY | [photo](https://www.inaturalist.org/photos/263702653) |
| *Crotalus molossus* | old photo snake tiny and far away, and CC BY-NC; sharp coiled adult | Matt Muir (iNat obs. [7694706](https://www.inaturalist.org/observations/7694706)) | CC BY | [photo](https://www.inaturalist.org/photos/10084702) |
| *Crotalus oreganus* | old photo twigs across the snake, and CC BY-NC; coiled adult at rock shelter | Parsa Fard (iNat obs. [288628756](https://www.inaturalist.org/observations/288628756)) | CC BY | [photo](https://www.inaturalist.org/photos/519075996) |
| *Thamnophis radix* | licence: old photo CC BY-NC; whole adult, stripes clear | B. P. White (iNat obs. [52596335](https://www.inaturalist.org/observations/52596335)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/83618975) |
| *Crotalus ruber* | licence: old photo CC BY-NC; sharp coiled adult among rocks | Alan Rockefeller (iNat obs. [21073857](https://www.inaturalist.org/observations/21073857)) | CC BY | [photo](https://www.inaturalist.org/photos/32562745) |
| *Arizona elegans* | licence: old photo CC BY-NC; sharp adult on sand | Linda Jo Conn (iNat obs. [258613009](https://www.inaturalist.org/observations/258613009)) | CC BY | [photo](https://www.inaturalist.org/photos/464038068) |
| *Imantodes cenchoa* | licence: old photo CC BY-NC; whole adult on log, head visible | John G. Phillips (iNat obs. [15239166](https://www.inaturalist.org/observations/15239166)) | CC BY | [photo](https://www.inaturalist.org/photos/22802301) |
| *Philothamnus semivariegatus* | licence: old photo CC BY-NC; head and body on branch | Dr. Thomas Dörner (iNat obs. [206257106](https://www.inaturalist.org/observations/206257106)) | CC BY-SA | [photo](https://www.inaturalist.org/photos/364779717) |
| *Dendrelaphis punctulatus* | licence: old photo CC BY-NC; sharp head and coils (yellow-green form) | dhfischer (iNat obs. [56719044](https://www.inaturalist.org/observations/56719044)) | CC BY | [photo](https://www.inaturalist.org/photos/90407544) |
| *Dendrelaphis pictus* | licence: old photo CC BY-NC; sharp head and forebody | Navapol Komanasin (iNat obs. [194422353](https://www.inaturalist.org/observations/194422353)) | CC BY | [photo](https://www.inaturalist.org/photos/341750165) |
| *Carphophis amoenus* | licence: old photo CC BY-NC; sharp adult on moss | Alex Stach (iNat obs. [195614725](https://www.inaturalist.org/observations/195614725)) | CC BY | [photo](https://www.inaturalist.org/photos/344200362) |
| *Boa imperator* | old photo dark and cluttered, and CC BY-NC; sharp adult resting on rock | Sebastián de Jesús Herrera Buenfil (iNat obs. [78869378](https://www.inaturalist.org/observations/78869378)) | CC BY | [photo](https://www.inaturalist.org/photos/129121475) |
| *Eryx jaculus* | licence: old photo CC BY-NC; sharp coiled adult on sand | Kseniia Marianna Prondzynska (iNat obs. [197624641](https://www.inaturalist.org/observations/197624641)) | CC BY | [photo](https://www.inaturalist.org/photos/348119707) |

Trimeresurus albolabris: the bottom 14% of the photo was cropped off to remove the photographer's name printed on it (tile is in the "cleaned" list, so SnakeList shows its own copy).

### Flagged and not yet replaced

No suitable commercial-OK replacement was found (most are rarely photographed species whose only open photos are of snakes in the hand), or the candidates were not clearly better. `CONTENT` = unsuitable content, `POOR` = composition/quality, `OK` = re-checked at full size and acceptable.

| species | category | issue |
|---|---|---|
| `epicrates-cenchria` | POOR | small on road |
| `python-molurus` | POOR | small in water |
| `dendroaspis-viridis` | POOR | hidden in vegetation |
| `acanthophis-antarcticus` | POOR | head not visible |
| `naja-mossambica` | POOR | on decking, head hidden |
| `liasis-olivaceus` | POOR | dark, head unclear |
| `psammophis-schokari` | POOR | shoe in frame |
| `bothriechis-lateralis` | POOR | hidden among leaves |
| `protobothrops-flavoviridis` | OK | checked at full size: acceptable (white belly up? possibly dead) |
| `crotalus-mitchellii` | POOR | hidden |
| `pseudonaja-affinis` | POOR | hidden |
| `liasis-mackloti` | POOR | unclear |
| `lampropeltis-pyromelana` | POOR | obstructed |
| `oligodon-cyclurus` | POOR | red paint spots on concrete |
| `thelotornis-kirtlandii` | POOR | head tiny |
| `philodryas-baroni` | POOR | tiny |
| `psammophis-sibilans` | POOR | obstructed |
| `nerodia-taxispilota` | POOR | obscured in vegetation |
| `pantherophis-spiloides` | POOR | obscured behind branches |
| `crotalus-cerberus` | POOR | dark obscured |
| `naja-annulata` | POOR | small in vegetation |
| `laticauda-semifasciata` | OK | checked at full size: acceptable (possibly in a container) |
| `boiga-cyanea` | POOR | hidden in foliage |
| `coelognathus-flavolineatus` | POOR | tiny |
| `gonyosoma-oxycephalum` | POOR | small on floor |
| `nerodia-cyclopion` | POOR | obscured in water |
| `tantilla-hobartsmithi` | POOR | pale, washed-out snake, possibly not healthy |
| `sistrurus-tergeminus` | POOR | small, head unclear |
| `vipera-dinniki` | POOR | obscured |
| `dolichophis-schmidti` | POOR | head not visible |
| `micrurus-mipartitus` | CONTENT | orange marker tape on snake |
| `hydrophis-curtus` | OK | checked at full size: acceptable (sea snake on land, maybe dead) |
| `tantilla-melanocephala` | POOR | tiny |
| `siphlophis-compressus` | POOR | obscured |
| `hydrophis-elegans` | POOR | small in water |
| `crotalus-polystictus` | POOR | head not visible |
| `lycodon-orientalis` | POOR | head not visible |
| `pseudonaja-modesta` | POOR | tiny |
| `imantodes-gemmistratus` | OK | checked at full size: acceptable (flattened body? possibly dead) |
| `pseudoboa-neuwiedii` | OK | checked at full size: acceptable (dark object at mouth, feeding?) |
| `naja-ashei` | POOR | small far away |
| `chrysopelea-pelias` | OK | checked at full size: acceptable (possibly hand/fingers at left) |
| `trimeresurus-hageni` | POOR | odd crop, no head |
| `hydrophis-major` | POOR | sea snake stranded on sand |
| `rhabdophis-swinhonis` | CONTENT | finger pointing at snake |
| `myriopholis-longicauda` | POOR | tiny |
| `boiga-multifasciata` | POOR | obscured |
| `atractus-elaps` | CONTENT | shoe in frame |
| `thamnodynastes-pallidus` | POOR | obscured by grass |
| `micrurus-dumerilii` | POOR | body only, no head |
| `micrurus-multifasciatus` | POOR | obscured |
| `naja-nubiae` | POOR | body only, no head |
| `lycodon-futsingensis` | OK | checked at full size: acceptable (black/white object near head) |
| `proatheris-superciliaris` | OK | checked at full size: acceptable (orange stick near head (hook/tongs?)) |
| `crotalus-totonacus` | POOR | tiny |
| `morelia-imbricata` | POOR | small |
| `bothrops-sanctaecrucis` | POOR | snake hidden in leaf litter |
| `dipsas-bicolor` | CONTENT | snake hook pressed on snake, shedding |
| `furina-tristis` | POOR | head hidden |
| `bungarus-magnimaculatus` | POOR | small far away |
| `homalophis-gyii` | CONTENT | eating a fish |
| `tantilla-deppei` | CONTENT | held on a hand |
| `micrurus-sangilensis` | CONTENT | snake hook/stick on snake |
| `hydrophis-caerulescens` | POOR | sea snake stranded on sand |
| `xenotyphlops-grandidieri` | CONTENT | printed copyright watermark on photo |
| `masticophis-bilineatus` | POOR | tiny |
| `pseudechis-papuanus` | CONTENT | in a plastic container |
| `leptophis-cupreus` | CONTENT | open-mouth gape |
| `melanophidium-wynaudense` | CONTENT | finger at frame edge |
| `erythrolamprus-guentheri` | OK | checked at full size: acceptable (orange marker on body?) |
| `protobothrops-xiangchengensis` | CONTENT | held in hand |
| `calamaria-nuchalis` | CONTENT | held in hand |
| `uromacer-frenatus` | OK | checked at full size: acceptable (band/tag on branch? (black ring)) |
| `tropidophis-feicki` | POOR | no head, body only |
| `amerotyphlops-paucisquamus` | POOR | extreme close-up of tail end |
| `calamaria-lateralis` | CONTENT | printed website watermark (ExploreHerpetology) |
| `eirenis-medus` | CONTENT | printed watermark bottom right |
| `gomesophis-brasiliensis` | CONTENT | open-mouth gape |
| `namibiana-gracilior` | CONTENT | held in hand |
| `siagonodon-cupinensis` | CONTENT | held in hand |
| `atractus-microrhynchus` | CONTENT | held on hand |
| `micrurus-silviae` | POOR | tiny in grass |
| `tantilla-petersi` | CONTENT | held in hand |
| `amerotyphlops-microstomus` | CONTENT | on tarp/plastic sheet, studio-like |
| `tetracheilostoma-breuili` | POOR | tiny on blank surface |
| `tantilla-impensa` | CONTENT | held between fingers |
| `oligodon-splendidus` | CONTENT | held on sleeve/hand |
| `tantilla-oaxacae` | CONTENT | held in hand |
| `epictia-tesselata` | CONTENT | held on palm |
| `fowlea-yunnanensis` | CONTENT | held in hand |
| `hydrophis-viperinus` | CONTENT | in a green tub |
| `sibon-carri` | CONTENT | on white cloth/bag (handled) |
| `aipysurus-eydouxii` | POOR | blurry underwater |
| `geophis-nigrocinctus` | CONTENT | on cloth/tarp, head hidden |
| `atractus-obtusirostris` | CONTENT | held on hand |
| `rhadinaea-fulvivittis` | CONTENT | printed name and logo watermark |
| `gerrhopilus-ater` | POOR | body only on leaf, no head |
| `typhlops-lumbricalis` | CONTENT | held in hand |
| `ramphotyphlops-depressus` | CONTENT | held in hand |
| `rhadinaea-bogertorum` | CONTENT | held in hand |
| `tropidophis-spiritus` | CONTENT | held in hand |
| `aparallactus-nigriceps` | CONTENT | held in hand |
| `hydrophis-semperi` | CONTENT | in a white bucket |
| `micrurus-diana` | CONTENT | on indoor tiled floor |
| `xenelaphis-ellipsifer` | POOR | head only, dark |
| `trachischium-fuscum` | CONTENT | printed photographer watermark bottom-left |
| `typhlops-rostellatus` | CONTENT | held in fingers |
| `helicops-petersi` | CONTENT | held in hands |
| `typhlops-pusillus` | CONTENT | held in fingers |
| `meizodon-regularis` | CONTENT | held in hand/bag |
| `afrotyphlops-elegans` | CONTENT | held in hand |
| `tropidonophis-halmahericus` | CONTENT | with rubbish/plastic, held? |
| `hydrops-caesurus` | POOR | almost invisible in water |
| `gloydius-monticola` | POOR | snake not visible |
| `oxybelis-potosiensis` | POOR | tiny |
| `atractus-natans` | CONTENT | held in hand |
| `atractus-erythromelas` | CONTENT | held in hand |
| `atractus-bocourti` | CONTENT | held in hand |
| `atractus-melas` | CONTENT | studio photo with printed watermark |
| `ramphotyphlops-flaviventer` | CONTENT | held in fingers |
| `tantilla-vulcani` | CONTENT | held in fingers |
| `philodryas-arnaldoi` | CONTENT | on plastic crate |
| `tantilla-cascadae` | OK | checked at full size: acceptable (watermark? hanging on wall) |
| `xylophis-stenorhynchus` | CONTENT | printed watermark bottom-right |
| `trimeresurus-cantori` | POOR | tiny |
| `hypsirhynchus-polylepis` | CONTENT | on hand/skin |
| `dendrelaphis-modestus` | CONTENT | held in fingers |
| `erythrolamprus-taeniurus` | CONTENT | finger in frame |
| `typhlops-schwartzi` | CONTENT | held in hand |
| `pseudorabdion-oxycephalum` | CONTENT | held in hand |
| `phalotris-concolor` | CONTENT | on skin/hand |
| `oligodon-modestus` | POOR | snake barely visible on bark |
| `atractus-indistinctus` | CONTENT | in a bucket |
| `oligodon-woodmasoni` | CONTENT | person's sandal/foot next to snake |
| `liotyphlops-wilderi` | CONTENT | held in fingers |
| `tantilla-lempira` | CONTENT | held in fingers |
| `liotyphlops-schubarti` | POOR | on indoor floor |
| `coniophanes-andresensis` | CONTENT | held in hand |
| `geophis-immaculatus` | CONTENT | held in hand + date stamp |
| `ptychophis-flavovirgatus` | POOR | very low resolution/blurry |
| `rhadinaea-omiltemana` | CONTENT | printed signature watermark |
| `tetralepis-fruhstorferi` | POOR | snake not visible |
| `atractus-chthonius` | CONTENT | held in fingers |
| `atractus-ecuadorensis` | CONTENT | held in fingers |
| `erythrolamprus-ornatus` | CONTENT | held in hands |
| `madatyphlops-arenarius` | POOR | body close-up only |
| `gloydius-liupanensis` | POOR | tiny in grass |
| `lycodryas-cococola` | POOR | tiny |
| `typhlops-sulcatus` | CONTENT | held in hand |
| `arrhyton-tanyplectum` | CONTENT | held in hand |
| `tropidonophis-punctiventris` | CONTENT | held in hand |
| `cylindrophis-yamdena` | CONTENT | plastic bag / shoe beside, tiny |
| `toxicodryas-vexator` | CONTENT | open mouth gape |
| `hydrophis-donaldi` | CONTENT | in a white tray of water |
| `dendrelaphis-biloreatus` | CONTENT | on indoor blue surface/container |
| `elapsoidea-laticincta` | POOR | snake not visible |
| `anilios-ammodytes` | CONTENT | held in hand |
| `liopeltis-rappi` | CONTENT | held in hand |
| `lycodon-multizonatus` | OK | checked at full size: acceptable (small printed watermark/logo) |
| `letheobia-somalica` | CONTENT | in white container |
| `anilios-chamodracaena` | CONTENT | held in hand |
| `anilios-guentheri` | CONTENT | held on hand/skin |
| `hebius-petersii` | CONTENT | eating a frog |
| `demansia-shinei` | CONTENT | in a plastic bag |
| `cyclotyphlops-deharvengi` | CONTENT | in a glass jar/container |
| `crotalus-vegrandis` | CONTENT | zoo enclosure with water bowl |
| `atheris-subocularis` | CONTENT | terrarium, foggy glass |
| `borikenophis-variegatus` | CONTENT | held in hand |
| `pareas-nigriceps` | CONTENT | held in fingers, blurry |
| `anilios-silvia` | CONTENT | held in hand |
| `atractus-zgap` | CONTENT | held in hand |
| `thamnophis-lineri` | CONTENT | snake tongs/hook on snake |
| `atractus-francoi` | OK | checked at full size: acceptable (eating? object at mouth) |
| `chironius-diamantina` | CONTENT | next to a toad (hunting/feeding scene) |
| `dipsas-latifrontalis` | CONTENT | in plastic container |
| `synophis-bogerti` | CONTENT | hanging from hook/stick |
| `amerotyphlops-arenensis` | CONTENT | held in hand |
| `amerotyphlops-costaricensis` | CONTENT | held in fingers |
| `sonora-mosaueri` | POOR | only body, no head |
| `lycophidion-semiannule` | CONTENT | held in hand |
| `prosymna-pitmani` | CONTENT | held in hand |
| `antillotyphlops-hypomethes` | CONTENT | held in fingers |
| `anilios-pilbarensis` | CONTENT | held in hand |
| `thamnophis-nigronuchalis` | CONTENT | dangling from hand |
| `compsophis-boulengeri` | CONTENT | held in hand |
| `psammophis-zambiensis` | POOR | extreme head close-up only |
| `oligodon-tuani` | POOR | tiny |
| `atractus-cerberus` | POOR | barely visible |
| `tropidophis-stejnegeri` | CONTENT | held in hand |
| `hebius-septemlineatus` | CONTENT | held in hand |
| `dipsas-jamespetersi` | CONTENT | held in hand |
| `myriopholis-ionidesi` | CONTENT | on finger/skin, extreme close-up |
| `kualatahan-pahangensis` | OK | checked at full size: acceptable (hand at bottom-left?) |
| `dasypeltis-palmarum` | POOR | extreme head close-up only |
| `echis-romani` | POOR | tiny |
| `antillotyphlops-monastus` | CONTENT | held on hand/glove |
| `elapoidis-sumatrana` | CONTENT | held in hand |
| `liopholidophis-dimorphus` | CONTENT | held in hands |
| `pseudoxyrhopus-ambreensis` | CONTENT | held by smiling person |
| `prosymna-somalica` | CONTENT | held on skin, close-up |
| `lycodonomorphus-obscuriventris` | CONTENT | held in hands |
| `epictia-amazonica` | CONTENT | held in hand |
| `antillotyphlops-catapontus` | POOR | extreme body close-up |
| `dipsas-lavillai` | CONTENT | held in hand |
| `gloydius-rickmersi` | CONTENT | held up on a snake hook |
| `azemiops-kharini` | OK | checked at full size: acceptable (white object at head) |
| `helicops-boitata` | CONTENT | in a white container |
| `atractus-marthae` | CONTENT | held in hand |
| `vipera-sakoi` | CONTENT | photographer in frame |
| `phalotris-illustrator` | CONTENT | in container with water |
| `dasypeltis-congolensis` | CONTENT | held in hand |
| `epictia-antoniogarciai` | CONTENT | hand touching snake |
| `boaedon-angolensis` | CONTENT | indoors on table with blue plastic |
| `masticophis-barbouri` | POOR | tiny |
| `cubatyphlops-biminiensis` | CONTENT | held in hands |
| `psammophis-turpanensis` | CONTENT | held in gloved hand |
| `uropeltis-grandis` | POOR | blurry, behind glass |
| `macrovipera-lebetinus` | POOR | snake small, washed out on cracked mud (famous species) |
| `letheobia-akagerae` | CONTENT | in a bucket |
| `boaedon-bocagei` | CONTENT | held on finger |
| `amerotyphlops-amoipira` | CONTENT | held in hand |
| `rhabdophis-flaviceps` | CONTENT | black plastic bag beside snake |
| `hebius-popei` | OK | checked at full size: acceptable (watermark logo bottom-left) |
| `stichophanes-ningshaanensis` | CONTENT | held in hand |
| `dolichophis-andreanus` | CONTENT | held in hand |
| `trimerodytes-yapingi` | CONTENT | held in hand |
| `incaspis-amaru` | CONTENT | held on hand/arm |
| `argyrophis-siamensis` | CONTENT | on a ruler/measuring board |
| `coronelaps-lepidus` | OK | checked at full size: acceptable (on pavement with yellow tag?) |
| `eristicophis-macmahoni` | CONTENT | captive with clay water bowl |
| `crotalus-lutosus` | CONTENT | tongs/object (blue stick) touching snake |
| `hebius-annamensis` | POOR | tiny |

### Species without a photo

970 species cards have no photo. The best-known of them (by fame score): `ogmodon-vitianus`, `hydrophis-belcheri`, `geophis-bellus`, `thermophis-baileyi`, `python-kyaiktiyo`, `naja-christyi`, `anomochilus-weberi`, `ramphotyphlops-exocoeti`, `calamaria-ulmeri`, `synophis-calamitus`, `micrurus-pachecogili`, `atractus-resplendens`, `calamaria-eiselti`, `calamaria-mecheli`, `eirenis-coronelloides`, `naja-multifasciata`, `ungaliophis-continentalis`, `chapinophis-xanthocheilus`, `calamaria-crassa`, `calamaria-doederleini`. Searching for open-licence photos of these was not done in this pass.

### What remains

- Replace the remaining NC photos, famous species first (the candidate script used for this pass is easy to rerun on the next 150 species).
- Re-search the flagged-but-unreplaced list periodically; held/container photos of rare species can only be replaced when new field photos appear.
- Look for photos for the most famous photo-less species.
- This pass judged identification from the tile and the iNaturalist research-grade taxon; it did not re-identify every existing photo against keys, so subtle misidentifications among lookalikes can remain.

## 2026-11-24 licence pass (commercial use)

SnakeList shows ads, so every photo must allow commercial use: CC0, public domain, CC BY or CC BY-SA (with credit). NC, ND (SnakeList crops every photo), "all rights reserved" and unknown licences are not OK without the photographer's permission.

- `data/photo-licences.json` lists every photo SnakeList shows (species tiles and opening photos) with its source, link, author, licence and `commercialOK`. Rebuild it with `python3 tools/photo_licences.py`.
- All 2460 species whose photo was not commercial-OK were searched: research-grade, wild (not captive), not-dead iNaturalist observations of the same taxon (matched by iNaturalist taxon id; subspecies accepted; a name iNaturalist treats as a synonym accepted only when it is the same species under a new genus or spelling, never when iNaturalist lumps it into another species) with photo licence CC0 / CC BY / CC BY-SA, plus the taxon's curated iNaturalist photos with those licences. Up to six candidates per species were viewed (cropped exactly as the tile) next to the old photo; handled, dead, feeding, gaping, in containers, on rulers, watermarked, tiny, blurry or doubtful-looking candidates were rejected.
- Photos already commercial-OK were not touched.
- Where the photographer of the old photo has since relicensed it (CC BY / CC0), the photo was kept and only its credit updated.
- Photos with no acceptable commercial-OK replacement were kept and listed in `docs/PHOTO-PERMISSIONS.md` / `data/photo-permissions.json`, with the photographer's iNaturalist username, a link to the original and a message template for asking permission.
- The species pages' runtime photo finder (for species with no built-in photo, `build_species.py`) now only takes CC0 / CC BY / CC BY-SA iNaturalist photos.
