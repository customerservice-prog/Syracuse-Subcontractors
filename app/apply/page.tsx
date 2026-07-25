import { db } from "@/lib/db";
import { brand } from "@/config/brand";
import { applyAction } from "./actions";
import type { Skill } from "@prisma/client";

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: { error?: string };
}) {
  const skills = await db.skill.findMany({ orderBy: { category: "asc" } });

  const skillsByCategory = skills.reduce<Record<string, Skill[]>>((acc, skill) => {
    acc[skill.category] = acc[skill.category] ? [...acc[skill.category], skill] : [skill];
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-10">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">Apply to work</h1>
        <p className="text-sm text-slate-600">
          {brand.name} activates workers based on contractor demand in {brand.market}. Submitting
          this application adds you to our waitlist for review - it does not guarantee an
          interview, approval, or hours.
        </p>
      </div>

      {searchParams.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {searchParams.error}
        </div>
      ) : null}

      <form action={applyAction} className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <label htmlFor="firstName" className="text-sm font-medium text-slate-700">First name</label>
            <input id="firstName" name="firstName" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="lastName" className="text-sm font-medium text-slate-700">Last name</label>
            <input id="lastName" name="lastName" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="phone" className="text-sm font-medium text-slate-700">Phone</label>
            <input id="phone" name="phone" type="tel" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700">Email</label>
            <input id="email" name="email" type="email" required className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <label htmlFor="address" className="text-sm font-medium text-slate-700">Address (optional)</label>
            <input id="address" name="address" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="transportation" className="text-sm font-medium text-slate-700">Transportation</label>
            <input id="transportation" name="transportation" placeholder="Own vehicle, public transit, etc." className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="workRadiusMiles" className="text-sm font-medium text-slate-700">Work radius (miles)</label>
            <input id="workRadiusMiles" name="workRadiusMiles" type="number" min="0" max="200" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
          <div className="space-y-1">
            <label htmlFor="referralCode" className="text-sm font-medium text-slate-700">Referral code (optional)</label>
            <input id="referralCode" name="referralCode" className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm" />
          </div>
        </div>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-slate-700">
            Skill categories you can work in (select at least one)
          </legend>
          {Object.entries(skillsByCategory).map(([category, categorySkills]) => (
            <div key={category} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{category}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {categorySkills.map((skill) => (
                  <label key={skill.id} className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" name="skillCategoryIds" value={skill.id} className="rounded border-slate-300" />
                    {skill.name}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </fieldset>

        <button type="submit" className="w-full rounded-md bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 sm:w-auto">
          Submit application
        </button>
      </form>
    </div>
  );
}
