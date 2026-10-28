"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { PasswordForm } from "@/components/PasswordForm";
import { PhoneInput } from "@/components/PhoneInput";
import { ProfileCard } from "@/components/ProfileCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WhatsAppVerify } from "@/components/WhatsAppVerify";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { phoneBody, phoneValue } from "@/lib/phone";
import type { User } from "@/lib/types";

export default function ProfilePage() {
  const { user, setUser, logout } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState({
    username: user?.username ?? "",
    phone: phoneValue(user?.phone),
    email: user?.email ?? "",
  });
  const [error, setError] = useState<ApiError | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const updated = await api<User>("/auth/me/", {
        method: "PATCH",
        body: {
          username: profile.username,
          ...phoneBody(profile.phone),
          email: profile.email || null,
        },
      });
      setUser(updated);
      setProfile((p) => ({ ...p, phone: phoneValue(updated.phone) }));
      toast.success("Profil mis à jour");
    } catch (err) {
      if (err instanceof ApiError) setError(err);
      toast.error(err instanceof ApiError ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  const fieldError = (name: string) =>
    error?.fieldError(name) && <p className="text-destructive text-xs">{error.fieldError(name)}</p>;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Profil" />

      <ProfileCard />

      <Card>
        <CardHeader>
          <CardTitle>Informations</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="username">Nom d’utilisateur</Label>
              <Input
                id="username"
                value={profile.username}
                onChange={(e) => setProfile({ ...profile, username: e.target.value })}
              />
              {fieldError("username")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">Téléphone</Label>
              <PhoneInput
                id="phone"
                required
                value={profile.phone}
                onChange={(phone) => setProfile({ ...profile, phone })}
                invalid={!!error?.fieldError("phone")}
              />
              {fieldError("phone")}
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">
                E-mail <span className="text-muted-foreground font-normal">(facultatif)</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={profile.email}
                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
              />
              {fieldError("email")}
            </div>
            <Button type="submit" className="self-start" disabled={saving}>
              {saving ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <WhatsAppVerify />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mot de passe</CardTitle>
        </CardHeader>
        <CardContent>
          <PasswordForm />
        </CardContent>
      </Card>

      <Button variant="destructive" className="h-11" onClick={handleLogout}>
        <LogOut /> Se déconnecter
      </Button>
    </div>
  );
}
