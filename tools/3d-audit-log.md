# 3D model audit (v6.13)

Request (Eduardo): "in 3d lots of snakes are still very incorrect, wrong patterns, not enough of patterns or colors or smth, wrong shape of smth, everything really so go and search for every snakes photo and see if its correct especially the smooth green snakes and other snakes."

## Method

- Every species that has a SnakeList photo (3099 species) was put beside its own model and checked by eye.
- The ~90 best-known species (ranked by the app's fame-data) were checked as photo | unrolled 3D pattern texture | rendered 3D model.
- The rest were checked in contact sheets of 48: photo + unrolled pattern strip.
- The ~435 snakes whose photo colours could not be read had fallen back to their group's grey-brown and a guessed pattern. They were checked on sheets that show the photo's own palette.
- Species without a photo (mostly fossils and little-known blind snakes) were not changed.
- Renders use Playwright and Chromium (SwiftShader) with the viewer's own mount() and surroundings off.
- Fixes live in data/snake-model-audit.json (one entry per species, applied by tools/auto_models.py apply_613) and, for the hand-checked species below, in tools/auto_models.py CURATED.

## Hand-checked species

| Species | Problem | Fix |
|---|---|---|
| opheodrys-vernalis (Smooth Green Snake) | Pale ring and brown iris in the eye; white lip band and chin read as a white blotch on the neck; back slightly dull | Iris near-black with no ring (round pupil); lips and chin pale yellow-green, and the whole-lip white block (lipFull) removed; back a clearer grass green #66b23a; belly pale yellow-green #dbe7a0. Body (smooth, slender, ld 62) and narrow head kept |
| lampropeltis-holbrooki (Speckled Kingsnake) | Small cream-yellow specks, cream belly and lips, orange eye; read grey-brown | Jet black #0b0b0b with one pure-white (#f6f6f2) oval spot on every scale (~40% of the scale, black border all round); larger scales (15 rows) so the spots read at normal distance; white lips with bold black sutures; white spots on the head shields; white belly chequered black; dark eye; colour deepening off |
| lampropeltis-californiae, lampropeltis-getula | Gold eyes; off-white bands and chain | Dark eyes; bands and chain pure white (see below) |
| lampropeltis-splendida, lampropeltis-nigra | Sparse dull specks, orange eye | Dense yellow flecks (desert) / white specks (black kingsnake); dark eyes |
| bungarus-candidus (Malayan krait) | Grey-brown with greyish bands | Jet black with pure white bands |

## White means white

Any marking colour (pattern, speckle, bands, stripes; never the ground or belly) that was near-white and near-neutral is now clean white #f4f4f0, and the skin's default 0.95 darkening is off for that snake (tools/auto_models.py white_613). Applied to 100 models: malayopython-reticulatus, crotalus-atrox, bungarus-caeruleus, lampropeltis-californiae, lampropeltis-getula, lampropeltis-triangulum, pantherophis-obsoletus, rhinophis-saffragamus, morelia-azurea, parafimbrios-vietnamensis, bungarus-walli, emydocephalus-orarius, lycodon-philippinus, lycodon-davisonii, limaformosa-capensis, pareas-niger, bungarus-suzhenae, lycodon-deccanensis, paraxenodermus-borneensis, lycodon-truongi, dipsas-aparatiritos, ophryacus-undulatus, crotalus-scutulatus, loveridgelaps-elapoides, vermicella-multifasciata, masticophis-schotti, dromicodryas-bernieri, prosymna-greigerti, trachischium-fuscum, tropidodipsas-zweifeli, tropidodipsas-philippii, tropidodipsas-fasciata, leptodrymus-pulcherrimus, psammophylax-tritaeniatus, telescopus-obtusus, thamnophis-saurita, lycophidion-semicinctum, lycophidion-variegatum, lycophidion-uzungwense, sibon-dimidiatus, spalerosophis-dolichospilus, pseudoleptodeira-latifasciata, corallus-caninus, python-brongersmai, hemachatus-haemachatus, acrochordus-granulatus, corallus-priscus, acrochordus-dehmi, lycodon-butleri, lycodon-ferroni, lycodon-ruhstrati, lycodon-stormi, cantoria-violacea, dipsas-pavonina, dipsas-bicolor, lycodon-carinatus, lycodon-septentrionalis, morelia-viridis, bungarus-multicinctus, bungarus-candidus, bungarus-bungaroides, micrurus-elegans, micrurus-medemi, calliophis-gracilis, micrurus-albicinctus, micrurus-ornatissimus, micrurus-serranus, epictia-subcrotilla, tropidodipsas-repleta, lampropeltis-intermedius, psammophis-phillipsii, hydrophis-donaldi, lycodon-dumerilii, tropidophis-grapiuna, mixcoatlus-melanurus, lycodon-gongshan, erythrolamprus-pyburni, xenodon-matogrossensis, lycodon-futsingensis, lampropeltis-nigra, xenodon-pulcher, erythrolamprus-juliae, lampropeltis-holbrooki, corallus-batesii, phalotris-sansebastiani, lycodon-synaptor, cubophis-ruttyi, lampropeltis-similis, crotalus-potterensis, afrotyphlops-liberiensis, crotalus-viridis, alsophis-antillensis, lycodon-striatus, cylindrophis-jodiae, epictia-vonmayi, siphlophis-ayauma, cylindrophis-ruffus, cylindrophis-burmanus, lygophis-lineatus, kelyophis-hechti.

## Per-species fixes from the photo sweep (821 species)

| Species | Problem / fix |
|---|---|
| acanthophis-praelongus | orange-buff with dark bands |
| adelophis-copei | orange-brown with dark lines |
| adelphicos-quadrivirgatum | pinkish brown, dark stripes |
| afronatrix-anoscopus | plain dark red-brown |
| afrotyphlops-elegans | yellow-orange with black marks |
| afrotyphlops-liberiensis | black with white blotches |
| afrotyphlops-lineolatus | iridescent blue-black |
| afrotyphlops-mucruso | dark grey-blue with pale lines |
| afrotyphlops-punctatus | pale with dark spots |
| ahaetulla-oxyrhyncha | bright green |
| ahaetulla-rufusoculara | bright green |
| aipysurus-duboisii | bands: plain dark |
| alsophis-antiguae | grey-olive with dark stripes |
| alsophis-antillensis | black with pale zigzag crossbars |
| alsophis-rijgersmaei | plain dark brown |
| alsophis-rufiventris | black with grey flecks |
| alsophis-sanctonum | plain: golden brown with dark lines |
| amastridium-veliferum | black |
| amblyodipsas-ventrimaculata | spotted: black with a broad yellow flank stripe |
| anilios-aspina | pink |
| anilios-australis | pink |
| anilios-chamodracaena | dark purple-brown |
| anilios-kimberleyensis | purplish pink |
| anilios-margaretae | dark purple-brown |
| anilios-pilbarensis | dark red-brown |
| anomalepis-mexicana | pink |
| anomochilus-monticola | black, orange marks near the tail |
| antaresia-maculosa | pale brown, many dark brown blotches |
| antillotyphlops-geotomus | mauve grey |
| antillotyphlops-platycephalus | blue (iridescent) |
| aparallactus-guentheri | plain grey: black with a pale collar |
| aplopeltura-boa | rusty brown, dark bands |
| apostolepis-albicollaris | orange with black head |
| apostolepis-ambiniger | pink, black head and tail tip |
| apostolepis-assimilis | saddles: plain orange with a black head and tail tip |
| apostolepis-cearensis | salmon with a black head |
| apostolepis-multicincta | banded: plain orange |
| apostolepis-nelsonjorgei | tan with dark stripes |
| apostolepis-nigroterminata | plain rusty brown, black tail tip |
| apostolepis-polylepis | plain: red with dark lines |
| apostolepis-quirogai | red with dark lines, black head |
| apostolepis-sanctaeritae | orange-red with a black head |
| apostolepis-thalesdelemai | orange-red with dark lines, black head |
| archelaphe-bella | dark red with pale crossbars |
| arrhyton-tanyplectum | dark back, yellow belly |
| aspidomorphus-muelleri | plain tan, dark head |
| aspidura-brachyorrhos | plain orange-brown |
| aspidura-copei | orange-red |
| asthenodipsas-borneensis | cream with dark bands |
| asthenodipsas-malaccanus | plain: black with pale blue bands |
| asthenodipsas-stuebingi | orange with dark bars |
| asthenodipsas-vertebralis | plain: brown with dark spots |
| atheris-ceratophora | plain: yellow with big black blotches |
| atheris-desaixi | black with yellow scales |
| atheris-hetfieldi | green |
| atheris-matildae | yellow scales on black read as plain |
| atractaspis-aterrima | saddles: plain dark grey |
| atractus-badius | dark brown with orange flank marks |
| atractus-bocki | dark with red blotches |
| atractus-clarki | black with an orange-red collar |
| atractus-ecuadorensis | dark brown |
| atractus-elaps | coloured but banded wrong way: black with orange-red bands |
| atractus-iridescens | crossbands: plain iridescent brown |
| atractus-lasallei | plain pinkish brown |
| atractus-latifrons | dark bands on grey: red with black bands |
| atractus-maculatus | red-brown with dark spots |
| atractus-major | orange-red with dark crossbars |
| atractus-meridensis | plain: red-orange with black bands |
| atractus-pachacamac | plain: black with red blotches |
| atractus-riveroi | plain dark brown |
| atractus-schach | plain grey: orange with dark saddles |
| atractus-spinalis | rusty brown with dark crossbands (was plain) |
| atractus-titanicus | grey with dark bands |
| atractus-typhon | plain: black with red blotches |
| atractus-vittatus | dark purple-brown |
| australiasis-amethystinus | olive-tan with dark bands |
| austrelaps-labialis | plain olive-grey |
| bitis-armata | grey with rows of dark spots |
| bitis-harenna | black with yellow marks |
| bitis-rubida | sandy-red with dark marks |
| bitis-schneideri | sandy, dark marks |
| boaedon-virgatus | plain grey |
| bogertophis-subocularis | plain: yellow with black H-shaped blotches |
| boiga-cynodon | buff, dark crossbands |
| boiga-drapiezii | grey-brown |
| boiga-flaviviridis | blotched: plain yellow-green |
| boiga-gocool | pale with dark bands |
| boiga-guangxiensis | red-brown with dark bands |
| boiga-hoeseli | pale with dark blotches |
| boiga-melanota | black with yellow bars |
| boiga-nigriceps | blotched: plain orange-red with a dark head |
| boiga-ochracea | plain ochre-orange |
| boiga-saengsomi | yellow with bold black marks |
| boiga-westermanni | black with pale cream marks |
| boiga-whitakeri | rusty brown, dark bars |
| boiruna-maculata | spotted: glossy black, red belly edge |
| bothriechis-nubestris | green-black with yellow flecks |
| bothrops-insularis | golden, faint marks |
| bothrops-jonathani | grey-olive, dark trapezoids |
| bothrops-lutzi | grey-brown, dark trapezoids |
| bothrops-monsignifer | dark grey with black trapezoids |
| brachyurophis-approximans | rusty brown with pale bands |
| brachyurophis-roperi | brown with dark-edged bands |
| bungarus-candidus | Malayan krait: grey-brown with greyish bands; it is jet black with pure white bands |
| bungarus-magnimaculatus | white with broad black bands |
| bungarus-suzhenae | black with white bands |
| bungarus-walli | black with thin pale bands |
| cacophis-harriettae | speckled: blue-grey with a white crown band |
| calamaria-albiventer | dark with red stripes |
| calamaria-arcana | dark purple-brown |
| calamaria-bicolor | dark with a yellow line low on the flank |
| calamaria-butonensis | purple-brown |
| calamaria-concolor | red |
| calamaria-dominici | black with yellow spots |
| calamaria-griswoldi | black with yellow lines |
| calamaria-hilleniusi | iridescent grey-purple |
| calamaria-lateralis | stripe: blue-black with a yellow flank stripe |
| calamaria-modesta | saddles: blue-black with yellow spots |
| calamaria-pavimentata | plain brown |
| calamaria-schlegeli | the red head |
| calamaria-yunnanensis | plain: black with an orange flank stripe |
| calliophis-bilineatus | coral: black with yellow stripes |
| calliophis-bivirgatus | coral rings: the blue coral snake is dark blue with a pale blue flank stripe and a red head and tail |
| calliophis-castoe | coral: pale grey with thin red lines |
| calliophis-gracilis | coral: black with white bands |
| calliophis-intestinalis | coral rings: this one is brown with stripes, not ringed |
| calliophis-maculiceps | coral rings: pink-red with tiny black flecks and a black head |
| calliophis-melanurus | coral rings: plain brown with a black head and tail, red belly |
| calliophis-nigrotaeniatus | coral: dark with red-orange lines |
| calliophis-philippinus | coral rings: plain dark grey |
| cantoria-violacea | plain: dark with pale bands |
| caraiba-andreae | dark with pale blue flecks |
| causus-rhombeatus | crossbands: now the dark rhombs (chevrons) down the back |
| cemophora-coccinea | faint: red saddles edged dark on a white ground |
| cemophora-lineri | white with red black-edged saddles |
| cerrophidion-petlalcalensis | grey-brown, dark blotches |
| chersodromus-australis | plain blue-black |
| chilabothrus-angulifer | buff, dark blotches |
| chilabothrus-chrysogaster | pale grey with small dark spots |
| chilabothrus-fordii | grey-brown, dark blotches |
| chilabothrus-inornatus | blotched: the Puerto Rican boa is plain brown |
| chilabothrus-monensis | pale with big brown blotches |
| chilorhinophis-gerardi | black with yellow stripes |
| chionactis-annulata | cream, black and orange bands (was brown) |
| chironius-flavolineatus | blue-grey, pale stripe |
| chironius-fuscus | saddles: plain brown |
| chironius-spixii | speckled: yellow-olive with dark lines |
| coelognathus-philippinus | olive with dark blotches |
| coelognathus-radiatus | plain: yellow-brown with black stripes on the forebody |
| coluber-rubriceps | plain grey |
| coniophanes-alvarezi | plain olive-brown |
| coniophanes-andresensis | plain reddish-brown |
| coniophanes-dromiciformis | brown, pale stripe |
| coniophanes-fissidens | rusty brown, dark stripes |
| coniophanes-melanocephalus | banded: red with a black head |
| coniophanes-meridanus | brown |
| coniophanes-taeniata | dark with pale stripes |
| conopsis-biserialis | grey-brown with two rows of dark spots (was striped) |
| corallus-cookii | plain: buff with dark blotches |
| coronella-brachyura | olive-brown, faint marks |
| craspedocephalus-andalasensis | salmon-pink with dark marks |
| craspedocephalus-borneensis | pinkish brown, dark blotches |
| craspedocephalus-brongersmai | plain orange-red |
| craspedocephalus-rubeus | bright green, red eye |
| craspedocephalus-strigatus | brown with dark marks |
| crotalus-caliginis | pale grey with dark white-edged blotches |
| crotalus-cerberus | plain: dark with black blotches |
| crotalus-concolor | pale yellowish with faint blotches |
| crotalus-lannomi | pinkish tan, dark blotches |
| crotalus-transversus | grey with dark crossbands |
| crotalus-tzabcan | pale grey, red-brown diamonds |
| crotaphopeltis-hotamboeia | slate grey, white flecks |
| cryophis-hallbergi | blue-grey with yellow-edged blotches |
| cryptelytrops-honsonensis | grey-blue |
| cryptophis-incredibilis | plain orange-red |
| cryptophis-nigrostriatus | red with a dark back stripe |
| cubophis-ruttyi | dark with pale flecks |
| cubophis-vudii | blackish with rusty flecks |
| cylindrophis-burmanus | dark with white bars |
| cylindrophis-jodiae | plain: black with pale bands |
| cylindrophis-maculatus | dark with pale salmon spots |
| cylindrophis-melanotus | black, red belly and tail |
| cylindrophis-opisthorhodus | orange-salmon |
| daboia-siamensis | grey, dark ovals |
| demansia-olivacea | olive-brown, dark-edged scales |
| demansia-papuensis | plain dark brown |
| demansia-reticulata | plain olive-buff |
| dendrelaphis-andamanensis | green |
| dendrelaphis-ngansonensis | orange-bronze |
| dendroaspis-jamesoni | dull grey-green: now green |
| dendrophidion-bivittatus | olive with yellow stripes |
| dendrophidion-brunneum | dark green |
| dendrophidion-clarkii | olive-green body, rusty head |
| dendrophidion-crybelum | brown with dark bars |
| dendrophidion-nuchale | green: brown |
| dendrophidion-paucicarinatum | dark olive-grey |
| dendrophidion-vinitor | olive with dark bars on the forebody |
| dipsadoboa-unicolor | brown: yellow-green |
| dipsadoboa-viridis | green |
| dipsas-alternans | pale grey, black bands |
| dipsas-aparatiritos | purple with pale bands |
| dipsas-articulata | white with black bands |
| dipsas-bicolor | black with white bands |
| dipsas-bobridgelyi | pink with black bands |
| dipsas-copei | black with cream bands |
| dipsas-elegans | buff with dark brown bands |
| dipsas-gaigeae | orange with black bands |
| dipsas-jamespetersi | cream with dark blotches |
| dipsas-nicholsi | yellow-brown with dark bands |
| dipsas-oneilli | buff with black bands |
| dipsas-oreas | grey-olive, dark bands |
| dipsas-palmeri | cream with black bands |
| dipsas-pavonina | black with white crossbands |
| dipsas-peruana | dark with pale bands |
| dipsas-sanctijoannis | dark brown, dark bands |
| dipsas-sazimai | pale buff with dark blotches |
| dipsas-welborni | white with brown bands |
| dipsas-williamsi | cream with black bands |
| ditypophis-vivax | plain orange-tan |
| dolichophis-andreanus | plain buff |
| dolichophis-schmidti | plain reddish-brown |
| drepanoides-anomalus | orange-red with a black and pale collar |
| drymobius-chloroticus | grey-brown: green |
| drymobius-melanotropis | grey-brown: green |
| drymobius-rhombifer | speckled: rusty with dark rhomb blotches |
| drymoluber-brazili | plain brown |
| drymoluber-dichrous | grey-brown: dark green with a yellow belly |
| drysdalia-coronoides | plain pale orange-brown |
| echinanthera-amoena | green |
| eirenis-collaris | buff with a black collar |
| eirenis-coronella | plain: pale with brown spots |
| eirenis-lineomaculatus | grey-brown with dark dots |
| eirenis-nigrofasciatus | white with black bands |
| eirenis-occidentalis | plain pale buff |
| eirenis-punctatolineatus | buff with dark dots |
| eirenis-rechingeri | pale grey-buff with dark stripes |
| elaphe-anomala | olive-brown, faint dark crossbars |
| elaphe-lineata | grey-brown with faint lines |
| elaphe-moellendorffi | olive-green with dark saddles, red head |
| elaphe-schrenckii | grey with dark saddles: now black with narrow pale-yellow crossbands |
| elaphe-taeniura | yellow-tan with dark marks and stripes |
| elapomorphus-quinquelineatus | orange-brown with dark lines |
| elapsoidea-boulengeri | dark grey with faint pale bands |
| elapsoidea-sundevallii | plain blue-black adult |
| emydocephalus-orarius | black with pale bands |
| enhydris-longicauda | plain olive-brown |
| enulius-roatanensis | plain black-brown |
| ephalophis-greyae | olive with dark bands |
| epicrates-assisi | dark brown, faint rings |
| epictia-australis | dark brown |
| epictia-goudotii | dark grey-brown |
| epictia-phenops | grey-brown lines, yellow tail tip |
| epictia-rufidorsa | brown with a pale stripe |
| epictia-subcrotilla | dark with pale lines |
| epictia-vonmayi | dark with pale lines |
| erythrolamprus-albertguentheri | brown: bright green |
| erythrolamprus-albiventris | plain olive-green |
| erythrolamprus-dorsocorallinus | saddles: dark with a red back stripe and yellow flanks |
| erythrolamprus-epinephelus | green with dark bars |
| erythrolamprus-fraseri | plain slate grey |
| erythrolamprus-frenatus | speckled: dark with red bars |
| erythrolamprus-jaegeri | plain grey-brown: green |
| erythrolamprus-juliae | plain: black with white-edged scales |
| erythrolamprus-melanotus | speckled: yellow with a broad black back stripe |
| erythrolamprus-poecilogyrus | plain: olive with black crossbars |
| erythrolamprus-pseudoreginae | dark olive-grey |
| erythrolamprus-pyburni | black and white with red |
| erythrolamprus-sagittifer | cream with black spots |
| erythrolamprus-viridis | plain green |
| erythrolamprus-vitti | red with black bands |
| erythrolamprus-zweifeli | yellow with dark edges |
| eryx-sistanensis | golden with dark net |
| euprepiophis-conspicillata | plain: red with small dark marks |
| euprepiophis-mandarinus | plain: grey with black yellow-centred saddles |
| euprepiophis-perlaceus | plain: olive-grey with dark bars |
| eutrachelophis-papilio | plain red-brown, pale head marks |
| exiliboa-placata | speckled: plain blue-grey |
| farancia-erytrogramma | plain grey: the rainbow snake is glossy black with red stripes and a red belly |
| ferania-sieboldii | plain: pale with dark blotches |
| fimbrios-klossi | iridescent blue-black |
| fordonia-leucobalia | plain grey-brown |
| fowlea-flavipunctatus | olive-yellow with dark spots |
| fowlea-punctulatus | dark with a pale line |
| furina-diadema | grey-brown: now red-brown with a black head and a red nape |
| furina-ornata | red-brown, black head |
| garthius-chaseni | plain: grey-brown with dark bands |
| geophis-betaniensis | black |
| geophis-brachycephalus | grey with red spots |
| geophis-cancellatus | plain: black with orange bands |
| geophis-duellmani | plain: dark with red bands |
| geophis-hoffmanni | black |
| geophis-immaculatus | grey-brown, pale belly |
| geophis-laticinctus | black with orange blotches |
| geophis-lorancai | orange-red with black bands |
| geophis-nasalis | iridescent blue-black |
| geophis-pyburni | plain grey |
| geophis-tarascae | plain black-grey |
| gloydius-lipipengi | pale with black hourglass blotches |
| gloydius-rubromaculatus | pale with red-brown blotches |
| gongylosoma-longicauda | brown with pale stripes |
| gonyosoma-boulengeri | bright green |
| gonyosoma-coeruleum | plain green |
| gonyosoma-margaritatum | green with yellow flecks |
| grayia-ornata | plain: olive with dark bands |
| gyalopion-canum | plain: tan with dark brown crossbands |
| gyalopion-quadrangulare | cream with black bands and red saddles (was plain grey) |
| habrophallos-collaris | black with a yellow collar |
| hapsidophrys-lineatus | green with black lines |
| hapsidophrys-principis | green |
| hapsidophrys-smaragdinus | bright green |
| hebius-beddomei | plain olive-yellow |
| hebius-deschauenseei | brown with dark lines |
| hebius-ishigakiensis | dark olive with yellow bars |
| hebius-johannis | black |
| hebius-miyajimae | brown with pale stripes |
| hebius-monticola | yellow with black bands |
| hebius-sarasinorum | reddish brown |
| hebius-sarawacensis | plain: dark with pale spots |
| hebius-sauteri | plain brown |
| hebius-weixiensis | olive-brown |
| helicops-carinicaudus | blotched: dark with an orange line on each flank |
| helicops-gomesi | black with red bars |
| helicops-infrataeniatus | olive with dark stripes |
| helicops-pastazae | brown with dark stripes |
| helicops-petersi | dark with orange stripes |
| helicops-polylepis | orange with darker spots |
| helminthophis-frontalis | dark with a pink head |
| hemerophis-socotrae | plain: buff with dark bars |
| hemibungarus-calligaster | coral-red with black bands |
| hemibungarus-mcclungi | saddles: orange with black rings |
| hemirhagerrhis-viperina | plain: grey with a dark zigzag |
| hemorrhois-nummifer | plain: grey with dark blotches |
| homalopsis-buccata | dark with pale cream bands (was plain) |
| homalopsis-nigroventralis | plain: tan with dark bands |
| homoroselaps-lacteus | yellow with black rings and an orange-red stripe (was plain grey spots) |
| hydrodynastes-gigas | plain: olive-yellow with dark blotches |
| hydrophis-coggeri | cream with black rings |
| hydrophis-gracilis | pale grey with dark bands |
| hydrophis-kingii | pale with dark bands |
| hydrophis-macdowelli | pale with black bands |
| hydrophis-nigrocinctus | yellow with black rings |
| hydrophis-pacificus | yellow-olive with dark bands |
| hydrophis-spiralis | yellow with black rings |
| hydrophis-viperinus | dark grey back, pale sides |
| hydrops-martii | plain: yellow-olive with dark bands |
| hypnale-hypnale | plain: now dark triangles along the flanks |
| hypsiglena-affinis | pinkish with dark blotches |
| hypsiglena-catalinae | tan with brown blotches |
| hypsiglena-tanzeri | grey with black blotches (pale) |
| hypsiglena-torquata | grey, dark blotches |
| hypsirhynchus-callilaemus | plain rusty red |
| ialtris-agyrtes | plain pinkish brown |
| imantodes-cenchoa | tan with dark brown blotches |
| imantodes-chocoensis | orange with darker blotches |
| imantodes-lentiferus | buff, dark blotches |
| indotyphlops-porrectus | dark brown |
| ithycyphus-goudoti | plain grey |
| lampropeltis-micropholis | plain: a ringed milk snake (black, red, white) |
| lampropeltis-nigra | black kingsnake: specks white, eye dark |
| lampropeltis-splendida | desert kingsnake: sparse dull specks and an orange eye; it is black densely flecked yellow, with a dark eye |
| lamprophis-abyssinicus | black |
| lamprophis-aurora | saddles: olive with an orange stripe down the back |
| lamprophis-erlangeri | dark grey |
| lamprophis-fiskii | plain: buff with dark spots |
| lamprophis-geometricus | plain brown |
| lamprophis-guttatus | pale grey with rusty spots |
| langaha-alluaudi | rusty brown leaf-nose |
| laticauda-schistorhyncha | bright blue with black rings |
| leioheterodon-geayi | pale with small dark spots |
| leioheterodon-madagascariensis | plain grey: it is black chequered with yellow |
| leiopython-albertisii | the black head of the white-lipped python |
| leptodeira-annulata | buff, dark saddles |
| leptodeira-ornata | pale with brown saddles |
| leptodeira-polysticta | orange with dark saddles |
| leptodeira-uribei | black with orange-red blotches (inverted) |
| leptodrymus-pulcherrimus | olive-green with pale stripes |
| leptophis-coeruleodorsus | olive-green with bronze stripe |
| leptophis-cupreus | speckled tan: turquoise |
| leptophis-diplotropis | pale saddles: plain green |
| leptophis-modestus | green |
| leptotyphlops-emini | grey-brown |
| leptotyphlops-merkeri | dark brown |
| liodytes-rigida | plain: dark stripes |
| liopeltis-calamaria | plain grey-brown |
| liophidium-apperti | grey with dark lines |
| liophidium-pattoni | black with yellow and pink stripes |
| liopholidophis-dolicocercus | orange with dark stripes |
| liotyphlops-beui | olive-brown |
| loveridgelaps-elapoides | plain: black with white bands |
| loxocemus-bicolor | blotched: plain glossy dark brown |
| lycodon-albofuscus | black |
| lycodon-anamallensis | pale grey-brown, faint bands |
| lycodon-butleri | plain: black with pale bands |
| lycodon-carinatus | plain: black with white bands |
| lycodon-cavernicolus | plain grey |
| lycodon-davisonii | black with white bands |
| lycodon-deccanensis | black with white bands |
| lycodon-dumerilii | black with white bands |
| lycodon-effraenis | plain: salmon with pale bands |
| lycodon-ferroni | dark brown with white bands |
| lycodon-flavomaculatus | spots read pale: dark grey with yellow spots |
| lycodon-flavozonatus | black with yellow bands (pale bands on dark, not dark on pale) |
| lycodon-futsingensis | plain: black with white bands |
| lycodon-gammiei | black with yellow-white bands |
| lycodon-gibsonae | plain: black with orange bands |
| lycodon-gongshan | plain: black with pale bands |
| lycodon-hypsirhinoides | bands: plain dark |
| lycodon-laoensis | black with yellow bands |
| lycodon-liuchengchaoi | black with tan bands |
| lycodon-meridionalis | plain: dark with yellow speckles |
| lycodon-multizonatus | orange with dark bands |
| lycodon-obvelatus | orange-salmon with black bands |
| lycodon-orientalis | grey-mauve, dark crossbars |
| lycodon-paucifasciatus | plain: black with pinkish bands |
| lycodon-philippinus | black with pale lines |
| lycodon-pictus | plain: pale with dark bands |
| lycodon-rosozonatus | black with pinkish bands |
| lycodon-ruhstrati | white bands narrower, as in the photo |
| lycodon-septentrionalis | black with white bands |
| lycodon-serratus | pale grey with dark bands |
| lycodon-stormi | black with white bands |
| lycodon-synaptor | plain: black with white bands |
| lycodon-truongi | black with white bands |
| lycodon-zayuensis | black with thin yellow bands |
| lycodon-zoosvictoriae | rusty brown with black specks |
| lycodryas-citrinus | blotched grey: yellow with black bands |
| lycodryas-granuliceps | pale with dark saddles |
| lycodryas-inopinae | blotched: plain golden |
| lycodryas-pseudogranuliceps | blotch: cream with dark saddles |
| lycophidion-depressirostre | plain purple-black |
| lycophidion-laterale | grey-brown, pale-tipped scales |
| lycophidion-multimaculatum | dark with pale bands |
| lycophidion-pembanum | dark purple-grey |
| lycophidion-semicinctum | dark with pale bands |
| lycophidion-uzungwense | dark with white-tipped scales, orange head |
| lycophidion-variegatum | plain: dark with white-tipped scales |
| lytorhynchus-maynardi | plain: tan with dark spots |
| lytorhynchus-ridgewayi | plain: pale with brown blotches |
| macroprotodon-mauritanicus | buff, dark specks |
| macrovipera-schweizeri | grey with faint spots |
| madagascarophis-colubrinus | plain: grey-olive with dark spots |
| madagascarophis-fuchsi | blotched: plain orange |
| madatyphlops-microcephalus | glossy black |
| masticophis-mentovarius | grey (the photo is grey) |
| masticophis-schotti | blue-green with pale flank lines |
| mastigodryas-cliftoni | orange-red |
| mastigodryas-dorsalis | bright green (was brown stripes) |
| mastigodryas-pulchriceps | black with pinkish flecks |
| meizodon-coronatus | plain dark grey-olive |
| meizodon-semiornatus | blue-grey |
| melanophidium-bilineatum | blue-black with a yellow flank stripe |
| melanophidium-punctatum | spots: iridescent black with a thin pale line |
| micrelaps-bicoloratus | black with yellow stripes |
| micrelaps-muelleri | black with pale bands |
| micropechis-ikaheka | grey-olive |
| micrurus-albicinctus | coral: black with thin white rings |
| micrurus-boicora | coral: blue-green dark (photo) |
| micrurus-elegans | black with pale rings and only faint red (dark morph in its photo) |
| micrurus-ephippifer | coral: this one is blue-grey with pale rings |
| micrurus-medemi | plain: dark with white rings |
| micrurus-narduccii | coral: dark blue-black, red belly |
| micrurus-ornatissimus | coral: dark with thin pale rings in its photo |
| micrurus-scutiventris | coral rings: black in its photo |
| micrurus-serranus | black-white with orange (black and white dominant) |
| micrurus-silviae | dark (photo shows a dark snake from above) |
| montivipera-albizona | orange with dark blotches |
| montivipera-bulgardaghica | plain: grey with dark blotches |
| montivipera-latifii | speckle: near plain sandy grey |
| montivipera-raddei | plain: brown with rows of dark spots |
| montivipera-wagneri | plain: pale grey with rows of dark orange-edged blotches |
| montivipera-xanthina | plain: pale grey-brown with a dark zigzag |
| morelia-bredli | pale dots: red-brown with big cream blotches |
| morelia-imbricata | olive with dark-ringed blotches |
| morelia-kinghorni | olive with faint blotches |
| muhtarophis-barani | plain rusty orange |
| mussurana-bicolor | plain brown: orange with a black head and back |
| mussurana-montana | red with a black head |
| myriopholis-ionidesi | pink |
| myriopholis-narirostris | pinkish |
| naja-annulata | dark brown with pale rings on the forebody |
| naja-haje | dark brown, not the guessed grey-brown |
| naja-katiensis | plain tan |
| naja-mandalayensis | plain tan |
| naja-mossambica | olive-brown, dark throat bars |
| naja-pallida | salmon-pink, black throat band (was grey-brown) |
| naja-sagittifera | olive-black |
| naja-samarensis | plain grey: black with yellow throat and belly |
| naja-savannula | plain: blue-black with pale bands |
| namibiana-gracilior | dark grey |
| natriciteres-bipostocularis | dark olive-grey, yellow lips |
| natrix-helvetica | grey-olive ground |
| natrix-natrix | flank marks were tiny dots and the back plain: now bold black bars down the flanks, two rows of small dark spots on the back, dark bars between the white lip scales |
| neelaps-bimaculatus | grey-brown, black head and nape |
| neelaps-calonotus | red-orange with pale-edged scales, black head |
| nerodia-clarkii | grey with dark stripes |
| ninia-sebae | plain brown: red with a black head and a pale and black collar |
| oligodon-ancorus | yellow with black bands |
| oligodon-annulifer | brown with orange bars |
| oligodon-barroni | rusty brown |
| oligodon-brevicauda | dark brown with reddish lines |
| oligodon-cinereus | saddles: plain orange-red |
| oligodon-dorsalis | brown with dark-edged pale stripe (was saddles) |
| oligodon-forbesi | olive-brown with pale stripes |
| oligodon-kheriensis | saddles: plain bright orange |
| oligodon-lipipengi | brown, dark saddles |
| oligodon-notospilus | dark with orange spots |
| oligodon-perkinsi | saddles: black with red stripes |
| oligodon-purpurascens | purplish brown, dark saddles |
| oligodon-taeniatus | pale, dark stripes |
| oligodon-theobaldi | saddles: buff with dark stripes |
| oligodon-tillacki | pale grey with black saddles |
| oligodon-trilineatus | black with red stripes |
| ophryacus-sphenophrys | golden-brown |
| opisthotropis-kikuzatoi | dark olive-grey |
| opisthotropis-maxwelli | olive-brown with faint pale stripes |
| opisthotropis-tamdaoensis | olive with dark lines, yellow belly |
| oxybelis-aeneus | yellow-green: the brown vine snake is grey-brown |
| oxybelis-koehleri | grey-brown vine snake |
| oxybelis-wilsoni | yellow vine snake |
| oxyrhopus-clathratus | coral: red with black bands |
| oxyrhopus-doliatus | black with red bands |
| oxyrhopus-formosus | saddles: plain red-orange |
| oxyrhopus-guibei | plain brown: orange-red with black bands |
| oxyrhopus-marcapatae | orange with black bands |
| oxyrhopus-melanogenys | coral rings: plain orange-red with a black head |
| oxyrhopus-occipitalis | plain brown: red with a black head |
| oxyrhopus-petolarius | plain: black with orange-red bands |
| parafimbrios-vietnamensis | iridescent dark purple, white neck patch |
| pararhadinaea-melanogaster | brown with pale stripes |
| parastenophis-betsileanus | white with black bands |
| paraxenodermus-borneensis | black with pale bars |
| pareas-chinensis | orange with dark bars |
| pareas-formosensis | buff with dark crossbars |
| pareas-geminatus | orange with dark bars |
| pareas-iwasakii | orange-brown, darker bars |
| pareas-kaduri | brown, dark bars |
| pareas-modestus | plain black |
| pareas-monticola | orange-red with dark bars (read grey) |
| pareas-niger | blue with pale marks |
| pareas-stanleyi | red-orange with dark bars |
| pareas-tigerinus | orange with dark spots |
| pareas-xuelinensis | orange with dark bars |
| phalotris-concolor | salmon with a black neck band |
| phalotris-lemniscatus | pinkish with dark lines |
| phalotris-mertensi | orange with a black and white collar |
| phalotris-multipunctatus | bright red |
| phalotris-nasutus | speckle: plain red |
| phalotris-nigrilatus | dark red |
| phalotris-sansebastiani | red with white and black collars |
| phalotris-shawnella | red-orange, black and white collar |
| philodryas-arnaldoi | yellow |
| philodryas-chamissonis | plain: brown with dark stripes |
| philodryas-livida | plain tan |
| philodryas-mattogrossensis | saddles: yellow with a dark back stripe |
| philodryas-trilineata | brown with pale stripes |
| philothamnus-bequaerti | green |
| philothamnus-semivariegatus | grey-brown with spots all over: now bright green with black spots on the forebody only |
| phimophis-guianensis | dark red with dark-edged scales, black head |
| phisalixella-arctifasciata | bands: plain orange |
| phisalixella-tulearensis | bands: plain orange-red |
| phisalixella-variabilis | plain yellow-tan |
| phrynonax-poecilonotus | plain: olive with dark mottled blotches |
| phrynonax-polylepis | plain olive-yellow |
| phyllorhynchus-browni | speckled: cream with a few big dark-brown saddles |
| pituophis-lineaticollis | grey, black blotches |
| plagiopholis-nuchalis | grey with pale-edged scales |
| platyceps-elegantissimus | pale blue-green with black bands |
| platyceps-rogersi | plain: pale with brown bars |
| platyceps-sinai | pale with dark bands |
| plectrurus-guentheri | red-brown, dark-edged scales |
| plesiodipsas-perijanensis | plain: golden with dark marks |
| porthidium-lansbergii | grey-brown, dark blotches |
| proatheris-superciliaris | plain: brown with dark flank triangles |
| prosymna-greigerti | brown with pale specks |
| prosymna-janii | dark with pale spots |
| protobothrops-dabieshanensis | brown, dark blotches |
| protobothrops-mangshanensis | olive: yellow-green with dark green blotches |
| protobothrops-tokarensis | pale pinkish grey, faint blotches |
| psammodynastes-pictus | plain: orange-tan with dark lines |
| psammophis-crucifer | brown with pale stripes |
| psammophis-elegans | brown with yellow stripes |
| psammophis-mossambicus | plain olive-brown |
| psammophis-namibensis | pale buff with dark-edged stripes |
| psammophis-praeornatus | plain grey-brown |
| psammophis-trinasalis | brown with pale stripes |
| psammophylax-rhombeatus | plain: brown with rows of dark rhomb spots |
| pseudagkistrodon-rudis | plain: pale with dark blotches |
| pseudalsophis-biserialis | buff with rows of dark spots |
| pseudalsophis-darwini | blue-black with pale flecks |
| pseudalsophis-hoodensis | brown with pale stripes |
| pseudalsophis-steindachneri | dark with tan stripes |
| pseudoboa-coronata | speckled: plain orange-red with a dark head |
| pseudoboa-haasi | saddles: plain red-brown |
| pseudoboa-martinsi | black back, orange flanks |
| pseudoboa-neuwiedii | speckled: plain orange-red with a dark head |
| pseudoboa-nigra | black |
| pseudoboodon-boehmei | yellow with dark stripes |
| pseudoboodon-lemniscatus | dark with yellow stripes |
| pseudocerastes-fieldi | plain: sandy with dark blotches |
| pseudoleptodeira-latifasciata | blotched: brown with pale bands |
| pseudonaja-aspidorhyncha | plain olive-grey |
| pseudonaja-guttata | pale buff, dark specks, dark nape |
| pseudonaja-mengdeni | plain orange-brown |
| pseudonaja-modesta | pale brown with thin dark bands |
| pseudoplectrurus-canaricus | yellow with dark spots |
| pseudorabdion-ater | black with a pale collar |
| pseudotomodon-trigonatus | pale grey with dark marks |
| pseudoxenodon-macrops | plain: yellow-olive with dark crossbars |
| pseudoxyrhopus-microps | plain dark red-brown |
| pseudoxyrhopus-tritaeniatus | dark with red-orange stripes |
| ptyas-mucosa | plain olive all over: now black crossbars on the rear half, as in the photo |
| ptyas-multicincta | bands: plain green |
| ptyas-nigromarginata | the green read olive in the scene |
| python-breitensteini | brown, irregular dark blotches |
| ramphotyphlops-flaviventer | dark brown, yellow belly |
| rhabdophis-auriculatus | brown with pale stripes |
| rhabdophis-confusus | green |
| rhabdophis-himalayanus | dark olive with orange flank patches |
| rhabdophis-spilogaster | olive-brown with dark spots |
| rhabdophis-swinhonis | dark brown |
| rhadinella-kanalchutchan | dark brown back, yellow-orange flanks and belly |
| rhamphiophis-oxyrhynchus | plain buff-brown |
| rhinocheilus-etheridgei | plain: red with black saddles |
| rhinophis-lineatus | yellow |
| rhinophis-zigzag | yellow-green with a dark blue zigzag |
| rhinotyphlops-unitaeniatus | blue-black with a yellow stripe |
| rhynchocalamus-melanocephalus | dull brown: orange with a black head |
| rhynchocalamus-satunini | speckled: plain orange with black head |
| rodriguesophis-iglesiasi | speckled: plain orange |
| salvadora-bairdi | plain: brown with dark stripes |
| salvadora-deserticola | plain: pale with dark stripes |
| salvadora-grahamiae | plain: pale with dark stripes |
| salvadora-gymnorhachis | grey-brown with dark stripes |
| salvadora-hexalepis | plain: grey with dark stripes |
| salvadora-lemniscata | plain: dark with pale stripes |
| salvadora-lineata | dark brown with pale stripes |
| salvadora-mexicana | plain: buff with dark stripes |
| scaphiodontophis-annulatus | red with dark bands at the front (plain brown model) |
| scaphiophis-albopunctatus | plain blue-grey |
| scaphiophis-raffreyi | plain pinkish tan |
| siagonodon-septemstriatus | orange with dark stripes |
| sibon-annulatus | buff, dark brown bands |
| sibon-anthracops | banded the wrong way: orange with black bands |
| sibon-argus | yellowish with dark-ringed spots |
| sibon-ayerbeorum | yellow with black blotches |
| sibon-carri | pale with dark bands |
| sibon-dimidiatus | dark red-brown with pale bands |
| sibon-irmelindicaprioae | yellow with black blotches |
| sibon-longifrenis | buff, dark bands |
| sibon-sanniolus | brown with dark spots |
| sibynophis-chinensis | saddles: plain brown with a black head |
| simalia-tracyae | pale with brown blotches |
| sinomicrurus-sauteri | coral rings: brown with thin dark lines |
| sinomicrurus-swinhoei | red-brown with black bands |
| siphlophis-ayauma | black with white bands |
| siphlophis-compressus | plain: red with black bands |
| siphlophis-leucocephalus | brown with dark marks, pale head |
| siphlophis-longicaudatus | brown with pale saddles |
| siphlophis-pulcher | dark with pink-red spots |
| siphlophis-worontzowi | black with pale bars |
| smithophis-bicolor | black back, orange flanks and belly |
| sonora-cincta | cream-orange with black bands |
| sonora-episcopa | banded: this one is plain orange-tan |
| sonora-michoacanensis | banded: white, black and red rings |
| sonora-mosaueri | plain brown |
| sonora-occipitalis | yellow with black bands |
| sonora-savagei | cream with dark bands |
| sonora-taylori | banded: plain grey |
| spalerosophis-atriceps | orange-brown |
| spalerosophis-diadema | orange-buff, many small blotches |
| spalerosophis-dolichospilus | pale grey-brown with pale-edged marks |
| spilotes-sulphureus | speckled grey: yellow-olive with dark crossbars on the rear body |
| stegonotus-modestus | plain grey: pinkish |
| stichophanes-ningshaanensis | orange |
| stoliczkia-vanhnuailianai | dark with yellow stripes |
| symphimus-mayae | blotched: pale cream with a thin dark line |
| sympholis-lippiens | plain: black with pale yellow bands |
| synophis-plectovertebralis | iridescent blue-black, yellow lateral line |
| synophis-zaheri | speckle: dark grey with a cream flank stripe |
| tachymenis-attenuata | brown with dark blotches |
| tachymenis-chilensis | grey-brown with dark stripes |
| taeniophallus-affinis | brown with pale stripes |
| taeniophallus-bilineatus | brown with dark stripes |
| taeniophallus-nicagus | orange-brown |
| taeniophallus-occipitalis | grey-brown, dark nape |
| taeniophallus-persimilis | black |
| taeniophallus-poecilopogon | plain dark red-brown |
| taeniophallus-quadriocellatus | grey-brown with dark spots |
| tantilla-armillata | grey-brown: reddish brown with a black head |
| tantilla-bocourti | olive-tan, dark head |
| tantilla-boipiranga | orange with a black head |
| tantilla-brevicauda | grey |
| tantilla-coronata | reddish brown, black head |
| tantilla-deppei | black head with a pale collar |
| tantilla-excelsa | brown with pale stripes, black head |
| tantilla-hobartsmithi | pale buff, black head |
| tantilla-impensa | dark with pale lower flank, pale collar |
| tantilla-lydia | rusty brown with yellow stripes |
| tantilla-melanocephala | brown, black head |
| tantilla-moesta | black with a yellow collar |
| tantilla-nigriceps | pale tan, black head |
| tantilla-planiceps | orange-tan, black head |
| tantilla-reticulata | brown with fine pale lines |
| tantilla-rubra | bright orange-red |
| tantilla-ruficeps | grey-brown |
| tantilla-schistosa | rich brown |
| tantilla-semicincta | plain: white with black bands |
| tantilla-supracincta | red with black bands |
| tantilla-wilcoxi | pale grey-brown, dark head |
| tantillita-lintoni | plain dark brown |
| telescopus-beetzi | buff with dark saddles (pale) |
| telescopus-fallax | pale grey-brown, dark blotches |
| telescopus-nigriceps | blotch: pale with dark bands, black head |
| telescopus-semiannulatus | orange with black blotches (was grey) |
| tetralepis-fruhstorferi | black |
| thamnodynastes-almae | brown with dark lines |
| thamnodynastes-chaquensis | grey with dark blotches |
| thamnodynastes-gambotensis | tan, dark flecks |
| thamnodynastes-hypoconia | grey-brown with dark lines |
| thamnodynastes-lanei | tan with brown lines |
| thamnodynastes-nattereri | plain orange |
| thamnodynastes-pallidus | pale buff, faint stripes |
| thamnodynastes-paraguanae | grey-brown, dark lines |
| thamnodynastes-phoenix | pale cream with dark marks |
| thamnodynastes-ramonriveroi | yellow-brown with dark lines |
| thamnodynastes-rutilus | tan, dark flecks |
| thamnodynastes-strigatus | mauve-brown with dark lines |
| thamnophis-atratus | plain: black with a yellow back stripe |
| thamnophis-butleri | dark olive, yellow stripes |
| thamnophis-fulvus | olive-brown, yellow stripes |
| thamnophis-lineri | olive with pale stripes |
| thamnophis-ordinoides | brown, orange stripes |
| thamnophis-radix | near-black ground, orange-yellow stripes |
| thamnosophis-epistibes | olive with yellow stripes |
| tomodon-dorsatus | buff with dark stripe |
| tomodon-ocellatus | grey with dark spots |
| tomodon-orestes | grey with dark blotches |
| toxicocalamus-ernstmayri | plain olive-yellow |
| toxicocalamus-stanleyanus | dark grey |
| toxicocalamus-vertebralis | dark olive |
| toxicodryas-adamanteus | tan, fine marks |
| toxicodryas-blandingii | plain: grey with dark mottled bands |
| trachischium-tenuiceps | plain grey |
| trachyboa-boulengeri | dark brown, orange tail |
| tretanorhinus-nigroluteus | saddles: plain dark |
| trilepida-pastusa | silvery grey |
| trimeresurus-andalasensis | pinkish brown, dark blotches |
| trimeresurus-caudornatus | bright green |
| trimeresurus-davidi | yellow-green |
| trimeresurus-gunaleni | bright green |
| trimeresurus-macrolepis | olive-yellow green |
| trimeresurus-mayaae | pale blue-green |
| trimeresurus-mcgregori | blotched: plain pale yellow |
| trimeresurus-mutabilis | grey-brown with dark blotches |
| trimeresurus-strigatus | brown with dark marks |
| trimeresurus-truongsonensis | green-grey with dark blotches |
| trimeresurus-wiroti | brown with dark blotches |
| trimetopon-gracile | dark grey-purple |
| trimetopon-pliolepis | plain dark brown |
| trimorphodon-lyrophanes | plain: pale with dark saddles |
| tropidodipsas-annulifera | black with yellow bands |
| tropidodipsas-fasciata | black with white rings |
| tropidodipsas-fischeri | blue-black with pale blue bands |
| tropidodipsas-papavericola | pale with dark bands |
| tropidodipsas-philippii | black with white bands |
| tropidodipsas-repleta | black with white bands |
| tropidodipsas-sartorii | orange with black bands |
| tropidodipsas-tricolor | black with orange bands |
| tropidodipsas-zweifeli | black with white bands |
| tropidolaemus-subannulatus | yellow-green with black bands (green read dull) |
| tropidonophis-doriae | orange-red with dark bars |
| tropidonophis-halmahericus | yellow |
| tropidonophis-mairii | brown, dark bars |
| tropidonophis-novaeguineae | dark olive, faint bars |
| tropidophis-canus | grey-brown with dark spots |
| tropidophis-feicki | pale with broad dark bands |
| tropidophis-haetianus | dark grey, faint spots |
| tropidophis-melanurus | buff with small dark spots |
| tropidophis-parkeri | dark brown |
| tropidophis-schwartzi | grey with dark spots |
| tropidophis-semicinctus | pale with black spots |
| tropidophis-steinleini | pale grey with black spots |
| tropidophis-stejnegeri | reddish with dark blotches |
| typhlops-pusillus | pinkish |
| typhlops-schwartzi | dark brown |
| ungaliophis-panamensis | speckled: pinkish with dark-edged triangles |
| uromacer-catesbyi | blotched: plain green |
| uromacerina-ricardinii | tan vine snake |
| uropeltis-bicatenata | black with yellow stripes |
| uropeltis-jerdoni | dark brown, yellow flank line |
| uropeltis-liura | olive-yellow with yellow-orange specks |
| uropeltis-macrolepis | dark with a broad yellow flank stripe |
| uropeltis-madurensis | plain: dark with yellow-edged scales |
| uropeltis-nitida | dark with yellow bands |
| uropeltis-phipsonii | plain: dark with pale-edged scales |
| uropeltis-rubrolineata | black with a yellow flank stripe |
| uropeltis-shorttii | black with yellow marks |
| uropeltis-woodmasoni | dark grey, yellow flank blotches |
| urotheca-fulviceps | plain brown: bright blue |
| urotheca-pachyura | blue-grey |
| vermicella-multifasciata | black with many white rings |
| vermicella-parscauda | black with pale blue rings |
| vipera-sakoi | yellow-brown with a dark zigzag |
| virginia-valeriae | plain grey-brown |
| xenelaphis-ellipsifer | brown with dark ovals |
| xenocalamus-mechowii | plain: pale with dark-ringed spots |
| xenochrophis-piscator | olive with dark chequer spots |
| xenochrophis-trianguligerus | olive with orange flank triangles |
| xenodon-dorbignyi | buff with dark-edged brown blotches |
| xenodon-guentheri | pale with dark-edged blotches |
| xenodon-matogrossensis | coral mimic: orange, black and white rings |
| xenodon-nattereri | blotched: plain tan |
| xenodon-neuwiedii | brown, dark-edged blotches |
| xenodon-pulcher | red, black and white rings (was brown bands) |
| xenodon-severus | dark blue-grey with pale-edged bands |
| xenodon-werneri | blue-grey, yellow belly |
| xenophidion-acanthognathus | brown with dark blotches |
| xenopholis-undulatus | plain: dark with an orange wavy line |
| xenoxybelis-argenteus | saddles: silvery buff with a dark stripe |
| xerotyphlops-vermicularis | pinkish |
| zaocys-dhumnades | olive-grey with dark stripes |
