ALTER TABLE public.cards ADD COLUMN affiliation text NOT NULL DEFAULT 'banner';
ALTER TABLE public.cards ADD CONSTRAINT cards_affiliation_check CHECK (affiliation IN ('banner', 'wayfarer'));
ALTER TABLE public.cards ALTER COLUMN banner_id DROP NOT NULL;
ALTER TABLE public.cards ADD CONSTRAINT cards_affiliation_banner_check CHECK ((affiliation = 'wayfarer') = (banner_id IS NULL));
ALTER TABLE public.cards ADD CONSTRAINT cards_wayfarer_unit_check CHECK (affiliation = 'banner' OR card_type = 'unit');
COMMENT ON COLUMN public.cards.affiliation IS 'banner = belongs to banner_id; wayfarer = shared troop with no Banner (banner_id is null), any summoner may recruit it';