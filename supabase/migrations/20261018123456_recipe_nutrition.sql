-- Phase 1: zentrale Makroberechnung pro Rezept (gesamt und pro Portion),
-- Gramm je Zutatengruppe und automatische Tags.
-- Liste, Wochenplan und Statistiken lesen alle aus dieser View.
-- security_invoker = true: die RLS der zugrunde liegenden Tabellen gilt für den Aufrufer.

create view public.recipe_nutrition
with (security_invoker = true)
as
with cfg as (
  select
    coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'high_protein_min_protein_g'), 30) as hp_min_g,
    coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'high_protein_min_kcal_share'), 0.3) as hp_min_share,
    coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'low_carb_max_carbs_g'), 20) as lc_max_g
),
totals as (
  select
    r.id as recipe_id,
    r.servings,
    count(ri.id) as ingredient_count,
    coalesce(sum(coalesce(ri.grams, 0)), 0) as grams_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.kcal / 100), 0) as kcal_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.protein / 100), 0) as protein_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.carbs / 100), 0) as carbs_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.fat / 100), 0) as fat_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.fiber / 100), 0) as fiber_total,
    coalesce(sum(coalesce(ri.grams, 0) * i.sugar / 100), 0) as sugar_total,
    coalesce(bool_and(i.diet = 'vegan'), false) as all_vegan,
    coalesce(bool_and(i.diet in ('vegan', 'vegetarian')), false) as all_vegetarian
  from public.recipes r
  left join public.recipe_ingredients ri on ri.recipe_id = r.id
  left join public.ingredients i on i.id = ri.ingredient_id
  group by r.id, r.servings
),
groups as (
  select
    x.recipe_id,
    jsonb_object_agg(x.food_group, round(x.grams, 1)) as grams_by_food_group
  from (
    select ri.recipe_id, i.food_group, sum(coalesce(ri.grams, 0)) as grams
    from public.recipe_ingredients ri
    join public.ingredients i on i.id = ri.ingredient_id
    group by ri.recipe_id, i.food_group
  ) x
  group by x.recipe_id
),
per_serving as (
  select
    t.*,
    t.kcal_total / t.servings as kcal_per_serving,
    t.protein_total / t.servings as protein_per_serving,
    t.carbs_total / t.servings as carbs_per_serving,
    t.fat_total / t.servings as fat_per_serving,
    t.fiber_total / t.servings as fiber_per_serving,
    t.sugar_total / t.servings as sugar_per_serving
  from totals t
)
select
  p.recipe_id,
  p.servings,
  p.ingredient_count::integer as ingredient_count,
  round(p.grams_total, 1) as grams_total,
  round(p.kcal_total, 1) as kcal_total,
  round(p.protein_total, 1) as protein_total,
  round(p.carbs_total, 1) as carbs_total,
  round(p.fat_total, 1) as fat_total,
  round(p.fiber_total, 1) as fiber_total,
  round(p.sugar_total, 1) as sugar_total,
  round(p.kcal_per_serving, 1) as kcal_per_serving,
  round(p.protein_per_serving, 1) as protein_per_serving,
  round(p.carbs_per_serving, 1) as carbs_per_serving,
  round(p.fat_per_serving, 1) as fat_per_serving,
  round(p.fiber_per_serving, 1) as fiber_per_serving,
  round(p.sugar_per_serving, 1) as sugar_per_serving,
  coalesce(g.grams_by_food_group, '{}'::jsonb) as grams_by_food_group,
  (
    p.ingredient_count > 0
    and (
      p.protein_per_serving >= cfg.hp_min_g
      or (p.kcal_per_serving > 0 and (p.protein_per_serving * 4) / p.kcal_per_serving >= cfg.hp_min_share)
    )
  ) as is_high_protein,
  (p.ingredient_count > 0 and p.carbs_per_serving <= cfg.lc_max_g) as is_low_carb,
  (p.ingredient_count > 0 and p.all_vegetarian) as is_vegetarian,
  (p.ingredient_count > 0 and p.all_vegan) as is_vegan
from per_serving p
cross join cfg
left join groups g on g.recipe_id = p.recipe_id;

revoke all on public.recipe_nutrition from anon;
grant select on public.recipe_nutrition to authenticated;
