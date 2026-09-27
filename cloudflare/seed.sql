INSERT OR REPLACE INTO flower_species
(species_key,name_ko,name_en,seed_price,difficulty,growth_minutes,completion_reward,season_label,active)
VALUES
('calendula','금잔화','Calendula',40,'쉬움',90,120,'9월 추천',1),
('cornflower','수레국화','Cornflower',60,'보통',120,150,'9월 추천',1),
('pansy','팬지','Pansy',80,'보통+',150,180,'9월~초10월',1),
('nigella','니겔라','Nigella',100,'어려움',180,220,'9월 추천',1);

INSERT OR REPLACE INTO growth_stage_assets
(species_key,stage_key,stage_order,stage_name_ko,r2_object_key,mime_type,asset_version,sha256,width,height,active)
VALUES
('calendula','seed',1,'씨앗','growth/calendula/seed.webp','image/webp',1,'b2a8976c30b9380bac88449770cfa9e24a8998c18a4c0425ad72e24f9d79cfe4',768,768,1),
('calendula','germination',2,'발아','growth/calendula/germination.webp','image/webp',1,'5ed12a420b7e19a7e41c2999bec43a45558f708463594c7aafb28d432cb3f328',768,768,1),
('calendula','sprout',3,'새싹','growth/calendula/sprout.webp','image/webp',1,'34b4ae2b8ab07efe770cec374fc8bea0d9bc4b0a68c0b89cd18ac9d29bbd3603',768,768,1),
('calendula','true_leaves',4,'본잎','growth/calendula/true_leaves.webp','image/webp',1,'ce217d2f0a17e21ec7d49af8c2526630920ab1f49c26643ac3f58d233745e77d',768,768,1),
('calendula','bud',5,'봉오리','growth/calendula/bud.webp','image/webp',1,'528cb536c544f6b7853c33d8293e9a2b7dae1cf18066bdb34cb0f2a40dd4b8ed',768,768,1),
('calendula','bloom',6,'개화','growth/calendula/bloom.webp','image/webp',1,'b2ae006dd07c2d67529cfb152f76d1de2689a08993caa73c846e775f7a1714e7',768,768,1);
