"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { CATEGORY_COLORS, CATEGORY_ICONS, CategoryIcon } from "@/components/CategoryBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ApiError } from "@/lib/api";
import type { Category, CategoryType } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

type Draft = Pick<Category, "name" | "type" | "color" | "icon"> & { id?: string };

const TYPE_LABELS: Record<CategoryType, string> = {
  expense: "Dépense",
  income: "Revenu",
  both: "Les deux",
};

const NEW_DRAFT: Draft = { name: "", type: "expense", color: CATEGORY_COLORS[0], icon: "tag" };

export function CategoryManager() {
  const { data: categories, reload } = useApi<Category[]>("/categories/");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const { id, ...body } = draft;
      await api(id ? `/categories/${id}/` : "/categories/", {
        method: id ? "PATCH" : "POST",
        body,
      });
      toast.success(id ? "Catégorie modifiée" : "Catégorie créée");
      setDraft(null);
      reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function remove(category: Category) {
    if (!window.confirm(`Supprimer la catégorie « ${category.name} » ?`)) return;
    try {
      await api(`/categories/${category.id}/`, { method: "DELETE" });
      toast.success("Catégorie supprimée");
      reload();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Suppression impossible.");
    }
  }

  const groups: CategoryType[] = ["expense", "income", "both"];

  return (
    <div className="flex flex-col gap-4">
      <Button
        variant="outline"
        className="self-start"
        onClick={() => {
          setError(null);
          setDraft(NEW_DRAFT);
        }}
      >
        <Plus /> Nouvelle catégorie
      </Button>

      {groups.map((type) => {
        const list = (categories ?? []).filter((c) => c.type === type);
        if (list.length === 0) return null;
        return (
          <section key={type}>
            <h3 className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
              {TYPE_LABELS[type]}
            </h3>
            <ul className="flex flex-col">
              {list.map((c) => (
                <li key={c.id} className="flex items-center gap-3 py-1.5">
                  <CategoryIcon icon={c.icon} color={c.color} className="size-8" />
                  <span className="flex-1 truncate text-sm">{c.name}</span>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Modifier ${c.name}`}
                    onClick={() => {
                      setError(null);
                      setDraft({
                        id: c.id,
                        name: c.name,
                        type: c.type,
                        color: c.color,
                        icon: c.icon,
                      });
                    }}
                  >
                    <Pencil />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Supprimer ${c.name}`}
                    onClick={() => remove(c)}
                  >
                    <Trash2 />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Modifier la catégorie" : "Nouvelle catégorie"}</DialogTitle>
          </DialogHeader>
          {draft && (
            <form
              id="category-form"
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="cat-name">Nom</Label>
                <Input
                  id="cat-name"
                  required
                  maxLength={60}
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                />
              </div>

              <div className="flex flex-col gap-2">
                <Label>Type</Label>
                <div className="bg-muted grid grid-cols-3 gap-1 rounded-lg p-1">
                  {groups.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setDraft({ ...draft, type: t })}
                      className={cn(
                        "rounded-md py-1.5 text-sm",
                        draft.type === t
                          ? "bg-background font-medium shadow-sm"
                          : "text-muted-foreground",
                      )}
                    >
                      {TYPE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Couleur</Label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORY_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      aria-label={color}
                      onClick={() => setDraft({ ...draft, color })}
                      className={cn(
                        "ring-offset-background size-7 rounded-full ring-offset-2",
                        draft.color === color && "ring-foreground ring-2",
                      )}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Icône</Label>
                <div className="grid grid-cols-7 gap-1.5">
                  {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
                    <button
                      key={key}
                      type="button"
                      aria-label={key}
                      onClick={() => setDraft({ ...draft, icon: key })}
                      className={cn(
                        "flex aspect-square items-center justify-center rounded-lg border",
                        draft.icon === key
                          ? "border-foreground bg-muted"
                          : "hover:bg-muted border-transparent",
                      )}
                      style={draft.icon === key ? { color: draft.color } : undefined}
                    >
                      <Icon className="size-4" />
                    </button>
                  ))}
                </div>
              </div>

              {error && <p className="text-destructive text-sm">{error}</p>}
            </form>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Annuler
            </Button>
            <Button type="submit" form="category-form" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
