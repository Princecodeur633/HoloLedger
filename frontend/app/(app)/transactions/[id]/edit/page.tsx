"use client";

import { ChevronLeft, Repeat, Trash2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "@/components/AppShell";
import { TransactionForm } from "@/components/TransactionForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/ui/skeleton";
import { api, ApiError } from "@/lib/api";
import type { Transaction } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export default function EditTransactionPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: tx, error } = useApi<Transaction>(`/transactions/${id}/`);

  async function handleDelete() {
    try {
      await api(`/transactions/${id}/`, { method: "DELETE" });
      toast.success("Opération supprimée");
      router.push("/transactions");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Suppression impossible.");
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <PageHeader
        title="Modifier l’opération"
        action={
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ChevronLeft /> Retour
          </Button>
        }
      />

      {error && (
        <p className="text-destructive text-sm">
          {error.status === 404 ? "Opération introuvable." : error.message}
        </p>
      )}
      {!tx && !error && <ListSkeleton />}

      {tx && (
        <>
          {tx.recurring_rule && (
            <div className="bg-muted mb-4 flex flex-col gap-3 rounded-xl p-4 text-sm">
              <p className="flex items-start gap-2">
                <Repeat className="mt-0.5 size-4 shrink-0" />
                <span>
                  Cette opération vient d’une opération récurrente. Si le montant était différent,
                  corrigez-le ci-dessous. Si vous ne l’avez pas faite ce jour-là, annulez-la : elle
                  disparaîtra de l’historique et du solde.
                </span>
              </p>
              <Button
                variant="outline"
                className="self-start"
                onClick={() => {
                  if (
                    window.confirm("Annuler cette opération ? Elle sera retirée de l’historique.")
                  )
                    handleDelete();
                }}
              >
                {tx.type === "expense"
                  ? "Je n’ai pas fait cette dépense"
                  : "Je n’ai pas reçu ce revenu"}
              </Button>
            </div>
          )}
          <TransactionForm
            key={tx.id}
            currency={tx.currency}
            initial={{
              type: tx.type,
              amount: String(Number(tx.amount)),
              date: tx.date,
              description: tx.description,
              category: tx.category,
              account: tx.account,
              source: tx.source,
              payment_method: tx.payment_method,
              note: tx.note,
            }}
            onSubmit={async (data) => {
              await api(`/transactions/${id}/`, { method: "PATCH", body: data });
              toast.success("Opération mise à jour");
              router.push("/transactions");
            }}
          />

          <AlertDialog>
            <AlertDialogTrigger
              render={
                <Button variant="destructive" className="mt-3 h-11 w-full">
                  <Trash2 /> Supprimer
                </Button>
              }
            />
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Supprimer cette opération ?</AlertDialogTitle>
                <AlertDialogDescription>Cette action est définitive.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Annuler</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleDelete}>
                  Supprimer
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
