// The Types of Christ answers: for each type, its hint as on the puzzle card, how the hint
// matches, and how the type points to Christ, then the KJV text of every passage referenced.
// SERVER ONLY. /api/types sends it once the committee shows the answers (Manage › Controls);
// nothing under app/ may import this file, or the answers would be in every phone's download
// before the results. `pnpm build` then grepping .output/public for a phrase from here checks it.
//
// The committee's words, from the participant guide's types page: Scripture quotes are exact KJV,
// and each type uses only the link the New Testament itself draws. Don't reword them here.
// Paragraphs use two marks (shared/utils/typesOfChrist.ts): [Rom 5:14](Romans 5:14) is a Bible
// reference, shown as its first part, and **At birth:** is bold. Every passage referenced needs
// its verses in `verses` (tests/data.test.ts checks).
import type { TypesOfChristPage } from '../shared/utils/typesOfChrist'

export const TYPES_OF_CHRIST: TypesOfChristPage = {
  intro: 'Types of Christ are people and things in the Old Testament that the New Testament shows pointing to Christ. Seeing them helps us appreciate God’s plan of salvation, and how Christ, the Messiah, fulfilled His word.',
  types: [
    {
      name: 'Adam',
      hint: ['What blocks the flow of water'],
      match: [
        'A dam. Say it out loud.',
      ],
      type: [
        'Adam is “the figure of him that was to come” ([Rom 5:14](Romans 5:14)). Christ is “the last Adam” and “the second man” ([1 Cor 15:45, 47](1 Corinthians 15:45,47)). Like Adam, He stands for everyone joined to Him, but unto righteousness, not condemnation: “For as by one man’s disobedience many were made sinners, so by the obedience of one shall many be made righteous” ([Rom 5:19](Romans 5:19)), and “as in Adam all die, even so in Christ shall all be made alive” ([1 Cor 15:22](1 Corinthians 15:22)). It’s a good place to start when sharing the gospel.',
      ],
      refs: 'NT:\u00a0[Rom 5:12–19](Romans 5:12-19); [1 Cor 15:21–22, 45–49](1 Corinthians 15:21-22,45-49)',
    },
    {
      name: 'Melchizedek',
      hint: ['“Without father, without mother”'],
      match: [
        '[Hebrews 7:3](Hebrews 7:3) describes Melchizedek this way: Scripture gives him no family line. So there is a priest God ordained without a priestly lineage.',
      ],
      type: [
        'Christ came from Judah, not from Levi, the priestly tribe: “For it is evident that our Lord sprang out of Juda; of which tribe Moses spake nothing concerning priesthood. And it is yet far more evident: for that after the similitude of Melchisedec there ariseth another priest, Who is made, not after the law of a carnal commandment, but after the power of an endless life. For he testifieth, Thou art a priest for ever after the order of Melchisedec” ([Heb 7:14–17](Hebrews 7:14-17)).',
        'The “carnal commandment” is the Levitical priesthood: carnal not in a sinful sense, but of the flesh, passed down by lineage and ended by death. Melchizedek, both king and priest, blessed Abram and received his tithes, so he is greater than the Levitical priests ([Heb 7:6–7](Hebrews 7:6-7)). Christ, our great High Priest, is greater still, because He lives for ever. God the Father swore it with an oath in [Psalm 110:4](Psalm 110:4), repeated in [Hebrews 5:6](Hebrews 5:6) and [7:17–21](Hebrews 7:17-21), and “he ever liveth to make intercession for them” ([Heb 7:25](Hebrews 7:25)).',
      ],
      refs: 'OT:\u00a0[Gen 14:18–20](Genesis 14:18-20); [Ps 110:4](Psalm 110:4) · NT:\u00a0[Heb 5:5–10](Hebrews 5:5-10); [6:20](Hebrews 6:20); [7:1–28](Hebrews 7:1-28)',
    },
    {
      name: 'Moses',
      hint: ['At birth, flowing waters heard I but did not see', 'When pressed, raging waters yielded, but temporarily', 'When stressed, abundant waters flowed, but without sanctity'],
      match: [
        '**At birth:** when his mother “could not longer hide him”, she laid him in “an ark of bulrushes” by “the river’s brink” ([Exo 2:3](Exodus 2:3)). The riddle pictures him hearing the river from inside the ark without seeing it, until Pharaoh’s daughter found him ([Exo 2:1–10](Exodus 2:1-10)).',
        '**Pressed:** with Pharaoh’s army behind, he stretched out his hand over the Red Sea and Israel crossed on dry ground. Then “the waters returned” over the Egyptians ([Exo 14:13–31](Exodus 14:13-31)).',
        '**Stressed:** when the people complained of no water, God told Moses to speak to the rock. Instead “he smote the rock twice: and the water came out abundantly” ([Num 20:11](Numbers 20:11)), but God told Moses and Aaron they had not sanctified Him ([Num 20:1–12](Numbers 20:1-12)).',
      ],
      type: [
        'God promised: “I will raise them up a Prophet from among their brethren, like unto thee, and will put my words in his mouth; and he shall speak unto them all that I shall command him” ([Deut 18:18](Deuteronomy 18:18)). Moses was the great prophet God raised up to lead Israel. Christ is the Prophet God promised, sent to teach the people, as Peter and Stephen both say ([Acts 3:20–23](Acts 3:20-23); [7:37](Acts 7:37)).',
      ],
      refs: 'OT:\u00a0[Deut 18:15–19](Deuteronomy 18:15-19) · NT:\u00a0[Acts 3:20–23](Acts 3:20-23); [7:37](Acts 7:37)',
    },
    {
      name: 'Male lamb without blemish',
      hint: ['“hand upon the head”'],
      match: [
        'In the burnt offering, “he shall put his hand upon the head of the burnt offering; and it shall be accepted for him to make atonement for him” ([Lev 1:4](Leviticus 1:4)). The worshipper joined himself to the lamb, owning that it took his place.',
      ],
      type: [
        'Christ, our atonement, is “the Lamb of God, which taketh away the sin of the world” ([John 1:29](John 1:29)), and we are redeemed “with the precious blood of Christ, as of a lamb without blemish and without spot” ([1 Pet 1:19](1 Peter 1:19)). The law had “a shadow of good things to come” ([Heb 10:1](Hebrews 10:1)). “For it is not possible that the blood of bulls and of goats should take away sins” ([Heb 10:4](Hebrews 10:4)). We are sanctified “through the offering of the body of Jesus Christ once for all” ([Heb 10:10](Hebrews 10:10)). As the lamb was accepted in the worshipper’s place, Christ “his own self bare our sins in his own body on the tree” ([1 Pet 2:24](1 Peter 2:24)).',
      ],
      refs: 'OT:\u00a0[Lev 1:3–4, 10](Leviticus 1:3-4,10) · NT:\u00a0[John 1:29](John 1:29); [Heb 10:4–10](Hebrews 10:4-10); [1 Pet 1:18–19](1 Peter 1:18-19); [2:24](1 Peter 2:24)',
    },
    {
      name: 'Bronze serpent',
      hint: ['“lifted up”'],
      match: [
        'When Israel spoke against God and Moses, the LORD sent fiery serpents and many died. Moses made a serpent of brass and “put it upon a pole”, and anyone bitten, “when he beheld the serpent of brass, he lived” ([Num 21:4–9](Numbers 21:4-9)). Jesus said Moses “lifted up the serpent” ([John 3:14](John 3:14)).',
      ],
      type: [
        'Christ applied it to Himself: “And as Moses lifted up the serpent in the wilderness, even so must the Son of man be lifted up: That whosoever believeth in him should not perish, but have eternal life” ([John 3:14–15](John 3:14-15)). He was lifted up on the cross, and whoever looks to Him in faith is saved: “And I, if I be lifted up from the earth, will draw all men unto me. This he said, signifying what death he should die” ([John 12:32–33](John 12:32-33)).',
      ],
      refs: 'OT:\u00a0[Num 21:4–9](Numbers 21:4-9) · NT:\u00a0[John 3:14–15](John 3:14-15); [12:32–33](John 12:32-33)',
    },
    {
      name: 'Jonah',
      hint: ['Gourdless pity'],
      match: [
        'God made a gourd grow to shade Jonah, then “prepared a worm” that smote it, so it withered ([Jonah 4:6–7](Jonah 4:6-7)). Left without his gourd, Jonah was angry ([Jonah 4:9](Jonah 4:9)). God told him he had “pity on the gourd”, and asked, “should not I spare Nineveh, that great city” ([Jonah 4:10–11](Jonah 4:10-11)). Jonah pitied a gourd but had no pity for Nineveh facing God’s judgment.',
      ],
      type: [
        'Jonah’s three days and three nights in the fish’s belly foreshadow Christ’s three days and three nights in the grave after the cross. It is the one sign Jesus gave the scribes and Pharisees: “For as Jonas was three days and three nights in the whale’s belly; so shall the Son of man be three days and three nights in the heart of the earth” ([Matt 12:40](Matthew 12:40)).',
      ],
      refs: 'OT:\u00a0[Jonah 1:17](Jonah 1:17) · NT:\u00a0[Matt 12:38–41](Matthew 12:38-41); [16:4](Matthew 16:4); [Luke 11:29–32](Luke 11:29-32)',
    },
  ],
  verses: {
    '1 Corinthians 15:21-22,45-49': [
      [21, 'For since by man came death, by man came also the resurrection of the dead.'],
      [22, 'For as in Adam all die, even so in Christ shall all be made alive.'],
      [45, 'And so it is written, The first man Adam was made a living soul; the last Adam was made a quickening spirit.'],
      [46, 'Howbeit that was not first which is spiritual, but that which is natural; and afterward that which is spiritual.'],
      [47, 'The first man is of the earth, earthy; the second man is the Lord from heaven.'],
      [48, 'As is the earthy, such are they also that are earthy: and as is the heavenly, such are they also that are heavenly.'],
      [49, 'And as we have borne the image of the earthy, we shall also bear the image of the heavenly.'],
    ],
    '1 Corinthians 15:22': [
      [22, 'For as in Adam all die, even so in Christ shall all be made alive.'],
    ],
    '1 Corinthians 15:45,47': [
      [45, 'And so it is written, The first man Adam was made a living soul; the last Adam was made a quickening spirit.'],
      [47, 'The first man is of the earth, earthy; the second man is the Lord from heaven.'],
    ],
    '1 Peter 1:18-19': [
      [18, 'Forasmuch as ye know that ye were not redeemed with corruptible things, as silver and gold, from your vain conversation received by tradition from your fathers;'],
      [19, 'But with the precious blood of Christ, as of a lamb without blemish and without spot:'],
    ],
    '1 Peter 1:19': [
      [19, 'But with the precious blood of Christ, as of a lamb without blemish and without spot:'],
    ],
    '1 Peter 2:24': [
      [24, 'Who his own self bare our sins in his own body on the tree, that we, being dead to sins, should live unto righteousness: by whose stripes ye were healed.'],
    ],
    'Acts 3:20-23': [
      [20, 'And he shall send Jesus Christ, which before was preached unto you:'],
      [21, 'Whom the heaven must receive until the times of restitution of all things, which God hath spoken by the mouth of all his holy prophets since the world began.'],
      [22, 'For Moses truly said unto the fathers, A prophet shall the Lord your God raise up unto you of your brethren, like unto me; him shall ye hear in all things whatsoever he shall say unto you.'],
      [23, 'And it shall come to pass, that every soul, which will not hear that prophet, shall be destroyed from among the people.'],
    ],
    'Acts 7:37': [
      [37, 'This is that Moses, which said unto the children of Israel, A prophet shall the Lord your God raise up unto you of your brethren, like unto me; him shall ye hear.'],
    ],
    'Deuteronomy 18:15-19': [
      [15, 'The LORD thy God will raise up unto thee a Prophet from the midst of thee, of thy brethren, like unto me; unto him ye shall hearken;'],
      [16, 'According to all that thou desiredst of the LORD thy God in Horeb in the day of the assembly, saying, Let me not hear again the voice of the LORD my God, neither let me see this great fire any more, that I die not.'],
      [17, 'And the LORD said unto me, They have well spoken that which they have spoken.'],
      [18, 'I will raise them up a Prophet from among their brethren, like unto thee, and will put my words in his mouth; and he shall speak unto them all that I shall command him.'],
      [19, 'And it shall come to pass, that whosoever will not hearken unto my words which he shall speak in my name, I will require it of him.'],
    ],
    'Deuteronomy 18:18': [
      [18, 'I will raise them up a Prophet from among their brethren, like unto thee, and will put my words in his mouth; and he shall speak unto them all that I shall command him.'],
    ],
    'Exodus 14:13-31': [
      [13, 'And Moses said unto the people, Fear ye not, stand still, and see the salvation of the LORD, which he will shew to you to day: for the Egyptians whom ye have seen to day, ye shall see them again no more for ever.'],
      [14, 'The LORD shall fight for you, and ye shall hold your peace.'],
      [15, 'And the LORD said unto Moses, Wherefore criest thou unto me? speak unto the children of Israel, that they go forward:'],
      [16, 'But lift thou up thy rod, and stretch out thine hand over the sea, and divide it: and the children of Israel shall go on dry ground through the midst of the sea.'],
      [17, 'And I, behold, I will harden the hearts of the Egyptians, and they shall follow them: and I will get me honour upon Pharaoh, and upon all his host, upon his chariots, and upon his horsemen.'],
      [18, 'And the Egyptians shall know that I am the LORD, when I have gotten me honour upon Pharaoh, upon his chariots, and upon his horsemen.'],
      [19, 'And the angel of God, which went before the camp of Israel, removed and went behind them; and the pillar of the cloud went from before their face, and stood behind them:'],
      [20, 'And it came between the camp of the Egyptians and the camp of Israel; and it was a cloud and darkness to them, but it gave light by night to these: so that the one came not near the other all the night.'],
      [21, 'And Moses stretched out his hand over the sea; and the LORD caused the sea to go back by a strong east wind all that night, and made the sea dry land, and the waters were divided.'],
      [22, 'And the children of Israel went into the midst of the sea upon the dry ground: and the waters were a wall unto them on their right hand, and on their left.'],
      [23, 'And the Egyptians pursued, and went in after them to the midst of the sea, even all Pharaoh’s horses, his chariots, and his horsemen.'],
      [24, 'And it came to pass, that in the morning watch the LORD looked unto the host of the Egyptians through the pillar of fire and of the cloud, and troubled the host of the Egyptians,'],
      [25, 'And took off their chariot wheels, that they drave them heavily: so that the Egyptians said, Let us flee from the face of Israel; for the LORD fighteth for them against the Egyptians.'],
      [26, 'And the LORD said unto Moses, Stretch out thine hand over the sea, that the waters may come again upon the Egyptians, upon their chariots, and upon their horsemen.'],
      [27, 'And Moses stretched forth his hand over the sea, and the sea returned to his strength when the morning appeared; and the Egyptians fled against it; and the LORD overthrew the Egyptians in the midst of the sea.'],
      [28, 'And the waters returned, and covered the chariots, and the horsemen, and all the host of Pharaoh that came into the sea after them; there remained not so much as one of them.'],
      [29, 'But the children of Israel walked upon dry land in the midst of the sea; and the waters were a wall unto them on their right hand, and on their left.'],
      [30, 'Thus the LORD saved Israel that day out of the hand of the Egyptians; and Israel saw the Egyptians dead upon the sea shore.'],
      [31, 'And Israel saw that great work which the LORD did upon the Egyptians: and the people feared the LORD, and believed the LORD, and his servant Moses.'],
    ],
    'Exodus 2:1-10': [
      [1, 'And there went a man of the house of Levi, and took to wife a daughter of Levi.'],
      [2, 'And the woman conceived, and bare a son: and when she saw him that he was a goodly child, she hid him three months.'],
      [3, 'And when she could not longer hide him, she took for him an ark of bulrushes, and daubed it with slime and with pitch, and put the child therein; and she laid it in the flags by the river’s brink.'],
      [4, 'And his sister stood afar off, to wit what would be done to him.'],
      [5, 'And the daughter of Pharaoh came down to wash herself at the river; and her maidens walked along by the river’s side; and when she saw the ark among the flags, she sent her maid to fetch it.'],
      [6, 'And when she had opened it, she saw the child: and, behold, the babe wept. And she had compassion on him, and said, This is one of the Hebrews’ children.'],
      [7, 'Then said his sister to Pharaoh’s daughter, Shall I go and call to thee a nurse of the Hebrew women, that she may nurse the child for thee?'],
      [8, 'And Pharaoh’s daughter said to her, Go. And the maid went and called the child’s mother.'],
      [9, 'And Pharaoh’s daughter said unto her, Take this child away, and nurse it for me, and I will give thee thy wages. And the women took the child, and nursed it.'],
      [10, 'And the child grew, and she brought him unto Pharaoh’s daughter, and he became her son. And she called his name Moses: and she said, Because I drew him out of the water.'],
    ],
    'Exodus 2:3': [
      [3, 'And when she could not longer hide him, she took for him an ark of bulrushes, and daubed it with slime and with pitch, and put the child therein; and she laid it in the flags by the river’s brink.'],
    ],
    'Genesis 14:18-20': [
      [18, 'And Melchizedek king of Salem brought forth bread and wine: and he was the priest of the most high God.'],
      [19, 'And he blessed him, and said, Blessed be Abram of the most high God, possessor of heaven and earth:'],
      [20, 'And blessed be the most high God, which hath delivered thine enemies into thy hand. And he gave him tithes of all.'],
    ],
    'Hebrews 10:1': [
      [1, 'For the law having a shadow of good things to come, and not the very image of the things, can never with those sacrifices which they offered year by year continually make the comers thereunto perfect.'],
    ],
    'Hebrews 10:10': [
      [10, 'By the which will we are sanctified through the offering of the body of Jesus Christ once for all.'],
    ],
    'Hebrews 10:4': [
      [4, 'For it is not possible that the blood of bulls and of goats should take away sins.'],
    ],
    'Hebrews 10:4-10': [
      [4, 'For it is not possible that the blood of bulls and of goats should take away sins.'],
      [5, 'Wherefore when he cometh into the world, he saith, Sacrifice and offering thou wouldest not, but a body hast thou prepared me:'],
      [6, 'In burnt offerings and sacrifices for sin thou hast had no pleasure.'],
      [7, 'Then said I, Lo, I come (in the volume of the book it is written of me,) to do thy will, O God.'],
      [8, 'Above when he said, Sacrifice and offering and burnt offerings and offering for sin thou wouldest not, neither hadst pleasure therein; which are offered by the law;'],
      [9, 'Then said he, Lo, I come to do thy will, O God. He taketh away the first, that he may establish the second.'],
      [10, 'By the which will we are sanctified through the offering of the body of Jesus Christ once for all.'],
    ],
    'Hebrews 5:5-10': [
      [5, 'So also Christ glorified not himself to be made an high priest; but he that said unto him, Thou art my Son, to day have I begotten thee.'],
      [6, 'As he saith also in another place, Thou art a priest for ever after the order of Melchisedec.'],
      [7, 'Who in the days of his flesh, when he had offered up prayers and supplications with strong crying and tears unto him that was able to save him from death, and was heard in that he feared;'],
      [8, 'Though he were a Son, yet learned he obedience by the things which he suffered;'],
      [9, 'And being made perfect, he became the author of eternal salvation unto all them that obey him;'],
      [10, 'Called of God an high priest after the order of Melchisedec.'],
    ],
    'Hebrews 5:6': [
      [6, 'As he saith also in another place, Thou art a priest for ever after the order of Melchisedec.'],
    ],
    'Hebrews 6:20': [
      [20, 'Whither the forerunner is for us entered, even Jesus, made an high priest for ever after the order of Melchisedec.'],
    ],
    'Hebrews 7:1-28': [
      [1, 'For this Melchisedec, king of Salem, priest of the most high God, who met Abraham returning from the slaughter of the kings, and blessed him;'],
      [2, 'To whom also Abraham gave a tenth part of all; first being by interpretation King of righteousness, and after that also King of Salem, which is, King of peace;'],
      [3, 'Without father, without mother, without descent, having neither beginning of days, nor end of life; but made like unto the Son of God; abideth a priest continually.'],
      [4, 'Now consider how great this man was, unto whom even the patriarch Abraham gave the tenth of the spoils.'],
      [5, 'And verily they that are of the sons of Levi, who receive the office of the priesthood, have a commandment to take tithes of the people according to the law, that is, of their brethren, though they come out of the loins of Abraham:'],
      [6, 'But he whose descent is not counted from them received tithes of Abraham, and blessed him that had the promises.'],
      [7, 'And without all contradiction the less is blessed of the better.'],
      [8, 'And here men that die receive tithes; but there he receiveth them, of whom it is witnessed that he liveth.'],
      [9, 'And as I may so say, Levi also, who receiveth tithes, payed tithes in Abraham.'],
      [10, 'For he was yet in the loins of his father, when Melchisedec met him.'],
      [11, 'If therefore perfection were by the Levitical priesthood, (for under it the people received the law,) what further need was there that another priest should rise after the order of Melchisedec, and not be called after the order of Aaron?'],
      [12, 'For the priesthood being changed, there is made of necessity a change also of the law.'],
      [13, 'For he of whom these things are spoken pertaineth to another tribe, of which no man gave attendance at the altar.'],
      [14, 'For it is evident that our Lord sprang out of Juda; of which tribe Moses spake nothing concerning priesthood.'],
      [15, 'And it is yet far more evident: for that after the similitude of Melchisedec there ariseth another priest,'],
      [16, 'Who is made, not after the law of a carnal commandment, but after the power of an endless life.'],
      [17, 'For he testifieth, Thou art a priest for ever after the order of Melchisedec.'],
      [18, 'For there is verily a disannulling of the commandment going before for the weakness and unprofitableness thereof.'],
      [19, 'For the law made nothing perfect, but the bringing in of a better hope did; by the which we draw nigh unto God.'],
      [20, 'And inasmuch as not without an oath he was made priest:'],
      [21, '(For those priests were made without an oath; but this with an oath by him that said unto him, The Lord sware and will not repent, Thou art a priest for ever after the order of Melchisedec:)'],
      [22, 'By so much was Jesus made a surety of a better testament.'],
      [23, 'And they truly were many priests, because they were not suffered to continue by reason of death:'],
      [24, 'But this man, because he continueth ever, hath an unchangeable priesthood.'],
      [25, 'Wherefore he is able also to save them to the uttermost that come unto God by him, seeing he ever liveth to make intercession for them.'],
      [26, 'For such an high priest became us, who is holy, harmless, undefiled, separate from sinners, and made higher than the heavens;'],
      [27, 'Who needeth not daily, as those high priests, to offer up sacrifice, first for his own sins, and then for the people’s: for this he did once, when he offered up himself.'],
      [28, 'For the law maketh men high priests which have infirmity; but the word of the oath, which was since the law, maketh the Son, who is consecrated for evermore.'],
    ],
    'Hebrews 7:14-17': [
      [14, 'For it is evident that our Lord sprang out of Juda; of which tribe Moses spake nothing concerning priesthood.'],
      [15, 'And it is yet far more evident: for that after the similitude of Melchisedec there ariseth another priest,'],
      [16, 'Who is made, not after the law of a carnal commandment, but after the power of an endless life.'],
      [17, 'For he testifieth, Thou art a priest for ever after the order of Melchisedec.'],
    ],
    'Hebrews 7:17-21': [
      [17, 'For he testifieth, Thou art a priest for ever after the order of Melchisedec.'],
      [18, 'For there is verily a disannulling of the commandment going before for the weakness and unprofitableness thereof.'],
      [19, 'For the law made nothing perfect, but the bringing in of a better hope did; by the which we draw nigh unto God.'],
      [20, 'And inasmuch as not without an oath he was made priest:'],
      [21, '(For those priests were made without an oath; but this with an oath by him that said unto him, The Lord sware and will not repent, Thou art a priest for ever after the order of Melchisedec:)'],
    ],
    'Hebrews 7:25': [
      [25, 'Wherefore he is able also to save them to the uttermost that come unto God by him, seeing he ever liveth to make intercession for them.'],
    ],
    'Hebrews 7:3': [
      [3, 'Without father, without mother, without descent, having neither beginning of days, nor end of life; but made like unto the Son of God; abideth a priest continually.'],
    ],
    'Hebrews 7:6-7': [
      [6, 'But he whose descent is not counted from them received tithes of Abraham, and blessed him that had the promises.'],
      [7, 'And without all contradiction the less is blessed of the better.'],
    ],
    'John 12:32-33': [
      [32, 'And I, if I be lifted up from the earth, will draw all men unto me.'],
      [33, 'This he said, signifying what death he should die.'],
    ],
    'John 1:29': [
      [29, 'The next day John seeth Jesus coming unto him, and saith, Behold the Lamb of God, which taketh away the sin of the world.'],
    ],
    'John 3:14': [
      [14, 'And as Moses lifted up the serpent in the wilderness, even so must the Son of man be lifted up:'],
    ],
    'John 3:14-15': [
      [14, 'And as Moses lifted up the serpent in the wilderness, even so must the Son of man be lifted up:'],
      [15, 'That whosoever believeth in him should not perish, but have eternal life.'],
    ],
    'Jonah 1:17': [
      [17, 'Now the LORD had prepared a great fish to swallow up Jonah. And Jonah was in the belly of the fish three days and three nights.'],
    ],
    'Jonah 4:10-11': [
      [10, 'Then said the LORD, Thou hast had pity on the gourd, for the which thou hast not laboured, neither madest it grow; which came up in a night, and perished in a night:'],
      [11, 'And should not I spare Nineveh, that great city, wherein are more than sixscore thousand persons that cannot discern between their right hand and their left hand; and also much cattle?'],
    ],
    'Jonah 4:6-7': [
      [6, 'And the LORD God prepared a gourd, and made it to come up over Jonah, that it might be a shadow over his head, to deliver him from his grief. So Jonah was exceeding glad of the gourd.'],
      [7, 'But God prepared a worm when the morning rose the next day, and it smote the gourd that it withered.'],
    ],
    'Jonah 4:9': [
      [9, 'And God said to Jonah, Doest thou well to be angry for the gourd? And he said, I do well to be angry, even unto death.'],
    ],
    'Leviticus 1:3-4,10': [
      [3, 'If his offering be a burnt sacrifice of the herd, let him offer a male without blemish: he shall offer it of his own voluntary will at the door of the tabernacle of the congregation before the LORD.'],
      [4, 'And he shall put his hand upon the head of the burnt offering; and it shall be accepted for him to make atonement for him.'],
      [10, 'And if his offering be of the flocks, namely, of the sheep, or of the goats, for a burnt sacrifice; he shall bring it a male without blemish.'],
    ],
    'Leviticus 1:4': [
      [4, 'And he shall put his hand upon the head of the burnt offering; and it shall be accepted for him to make atonement for him.'],
    ],
    'Luke 11:29-32': [
      [29, 'And when the people were gathered thick together, he began to say, This is an evil generation: they seek a sign; and there shall no sign be given it, but the sign of Jonas the prophet.'],
      [30, 'For as Jonas was a sign unto the Ninevites, so shall also the Son of man be to this generation.'],
      [31, 'The queen of the south shall rise up in the judgment with the men of this generation, and condemn them: for she came from the utmost parts of the earth to hear the wisdom of Solomon; and, behold, a greater than Solomon is here.'],
      [32, 'The men of Nineve shall rise up in the judgment with this generation, and shall condemn it: for they repented at the preaching of Jonas; and, behold, a greater than Jonas is here.'],
    ],
    'Matthew 12:38-41': [
      [38, 'Then certain of the scribes and of the Pharisees answered, saying, Master, we would see a sign from thee.'],
      [39, 'But he answered and said unto them, An evil and adulterous generation seeketh after a sign; and there shall no sign be given to it, but the sign of the prophet Jonas:'],
      [40, 'For as Jonas was three days and three nights in the whale’s belly; so shall the Son of man be three days and three nights in the heart of the earth.'],
      [41, 'The men of Nineveh shall rise in judgment with this generation, and shall condemn it: because they repented at the preaching of Jonas; and, behold, a greater than Jonas is here.'],
    ],
    'Matthew 12:40': [
      [40, 'For as Jonas was three days and three nights in the whale’s belly; so shall the Son of man be three days and three nights in the heart of the earth.'],
    ],
    'Matthew 16:4': [
      [4, 'A wicked and adulterous generation seeketh after a sign; and there shall no sign be given unto it, but the sign of the prophet Jonas. And he left them, and departed.'],
    ],
    'Numbers 20:1-12': [
      [1, 'Then came the children of Israel, even the whole congregation, into the desert of Zin in the first month: and the people abode in Kadesh; and Miriam died there, and was buried there.'],
      [2, 'And there was no water for the congregation: and they gathered themselves together against Moses and against Aaron.'],
      [3, 'And the people chode with Moses, and spake, saying, Would God that we had died when our brethren died before the LORD!'],
      [4, 'And why have ye brought up the congregation of the LORD into this wilderness, that we and our cattle should die there?'],
      [5, 'And wherefore have ye made us to come up out of Egypt, to bring us in unto this evil place? it is no place of seed, or of figs, or of vines, or of pomegranates; neither is there any water to drink.'],
      [6, 'And Moses and Aaron went from the presence of the assembly unto the door of the tabernacle of the congregation, and they fell upon their faces: and the glory of the LORD appeared unto them.'],
      [7, 'And the LORD spake unto Moses, saying,'],
      [8, 'Take the rod, and gather thou the assembly together, thou, and Aaron thy brother, and speak ye unto the rock before their eyes; and it shall give forth his water, and thou shalt bring forth to them water out of the rock: so thou shalt give the congregation and their beasts drink.'],
      [9, 'And Moses took the rod from before the LORD, as he commanded him.'],
      [10, 'And Moses and Aaron gathered the congregation together before the rock, and he said unto them, Hear now, ye rebels; must we fetch you water out of this rock?'],
      [11, 'And Moses lifted up his hand, and with his rod he smote the rock twice: and the water came out abundantly, and the congregation drank, and their beasts also.'],
      [12, 'And the LORD spake unto Moses and Aaron, Because ye believed me not, to sanctify me in the eyes of the children of Israel, therefore ye shall not bring this congregation into the land which I have given them.'],
    ],
    'Numbers 20:11': [
      [11, 'And Moses lifted up his hand, and with his rod he smote the rock twice: and the water came out abundantly, and the congregation drank, and their beasts also.'],
    ],
    'Numbers 21:4-9': [
      [4, 'And they journeyed from mount Hor by the way of the Red sea, to compass the land of Edom: and the soul of the people was much discouraged because of the way.'],
      [5, 'And the people spake against God, and against Moses, Wherefore have ye brought us up out of Egypt to die in the wilderness? for there is no bread, neither is there any water; and our soul loatheth this light bread.'],
      [6, 'And the LORD sent fiery serpents among the people, and they bit the people; and much people of Israel died.'],
      [7, 'Therefore the people came to Moses, and said, We have sinned, for we have spoken against the LORD, and against thee; pray unto the LORD, that he take away the serpents from us. And Moses prayed for the people.'],
      [8, 'And the LORD said unto Moses, Make thee a fiery serpent, and set it upon a pole: and it shall come to pass, that every one that is bitten, when he looketh upon it, shall live.'],
      [9, 'And Moses made a serpent of brass, and put it upon a pole, and it came to pass, that if a serpent had bitten any man, when he beheld the serpent of brass, he lived.'],
    ],
    'Psalm 110:4': [
      [4, 'The LORD hath sworn, and will not repent, Thou art a priest for ever after the order of Melchizedek.'],
    ],
    'Romans 5:12-19': [
      [12, 'Wherefore, as by one man sin entered into the world, and death by sin; and so death passed upon all men, for that all have sinned:'],
      [13, '(For until the law sin was in the world: but sin is not imputed when there is no law.'],
      [14, 'Nevertheless death reigned from Adam to Moses, even over them that had not sinned after the similitude of Adam’s transgression, who is the figure of him that was to come.'],
      [15, 'But not as the offence, so also is the free gift. For if through the offence of one many be dead, much more the grace of God, and the gift by grace, which is by one man, Jesus Christ, hath abounded unto many.'],
      [16, 'And not as it was by one that sinned, so is the gift: for the judgment was by one to condemnation, but the free gift is of many offences unto justification.'],
      [17, 'For if by one man’s offence death reigned by one; much more they which receive abundance of grace and of the gift of righteousness shall reign in life by one, Jesus Christ.)'],
      [18, 'Therefore as by the offence of one judgment came upon all men to condemnation; even so by the righteousness of one the free gift came upon all men unto justification of life.'],
      [19, 'For as by one man’s disobedience many were made sinners, so by the obedience of one shall many be made righteous.'],
    ],
    'Romans 5:14': [
      [14, 'Nevertheless death reigned from Adam to Moses, even over them that had not sinned after the similitude of Adam’s transgression, who is the figure of him that was to come.'],
    ],
    'Romans 5:19': [
      [19, 'For as by one man’s disobedience many were made sinners, so by the obedience of one shall many be made righteous.'],
    ],
  },
}
