"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { toast } from "../ui/use-toast";
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
} from "../ui/alert-dialog";
import { Copy, Loader2, Plus, Trash2 } from "lucide-react";

const ALL_SCOPES = [
  "profile:read",
  "profile:write",
  "jobs:read",
  "jobs:write",
  "cv:write",
];

interface TokenRow {
  id: string;
  name: string;
  last8: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
}

function PersonalAccessTokens() {
  const [tokens, setTokens] = useState<TokenRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<string[]>([
    "profile:read",
    "jobs:write",
    "cv:write",
  ]);
  const [justCreated, setJustCreated] = useState<{
    token: string;
    name: string;
  } | null>(null);

  const fetchTokens = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/v1/tokens");
      const data = await res.json();
      setTokens(data.tokens ?? []);
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTokens();
  }, []);

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  };

  const handleCreate = async () => {
    if (!name.trim() || selectedScopes.length === 0) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), scopes: selectedScopes }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Create failed",
          description: data.error ?? "Unknown error",
        });
        return;
      }
      setJustCreated({ token: data.token, name: data.name });
      setName("");
      await fetchTokens();
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: string) => {
    const res = await fetch(`/api/v1/tokens/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast({ variant: "success", title: "Token revoked" });
      await fetchTokens();
    } else {
      const data = await res.json();
      toast({
        variant: "destructive",
        title: "Revoke failed",
        description: data.error,
      });
    }
  };

  const copyToken = async (token: string) => {
    await navigator.clipboard.writeText(token);
    toast({ variant: "success", title: "Copied to clipboard" });
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-medium">Personal Access Tokens</h3>
        <p className="text-sm text-muted-foreground">
          Tokens let external tools (Claude Code skills, CLI clients) call the
          JobSync API on your behalf. The plain-text token is shown only once at
          creation — save it immediately.
        </p>
      </div>

      {justCreated && (
        <Card className="border-green-500">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Token created: {justCreated.name}
            </CardTitle>
            <CardDescription>
              Copy now. Closing this card means you can never see it again.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-muted p-2 rounded text-xs break-all">
                {justCreated.token}
              </code>
              <Button
                size="sm"
                variant="outline"
                onClick={() => copyToken(justCreated.token)}
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy
              </Button>
              <Button size="sm" onClick={() => setJustCreated(null)}>
                I&apos;ve saved it
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Create new token</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label htmlFor="token-name">Name</Label>
            <Input
              id="token-name"
              placeholder="e.g. claude-code-mac"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Scopes</Label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_SCOPES.map((scope) => (
                <Badge
                  key={scope}
                  variant={
                    selectedScopes.includes(scope) ? "default" : "outline"
                  }
                  className="cursor-pointer"
                  onClick={() => toggleScope(scope)}
                >
                  {scope}
                </Badge>
              ))}
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!name.trim() || selectedScopes.length === 0 || creating}
          >
            {creating ? (
              <Loader2 className="mr-2 h-3 w-3 animate-spin" />
            ) : (
              <Plus className="h-3 w-3 mr-1" />
            )}
            Create token
          </Button>
        </CardContent>
      </Card>

      <div>
        <h4 className="text-sm font-medium mb-2">Active tokens</h4>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <div className="space-y-2">
            {tokens.map((t) => (
              <Card key={t.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{t.name}</span>
                        <code className="text-xs text-muted-foreground">
                          ····{t.last8}
                        </code>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {t.scopes.map((s) => (
                          <Badge
                            key={s}
                            variant="secondary"
                            className="text-xs"
                          >
                            {s}
                          </Badge>
                        ))}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Created {new Date(t.createdAt).toLocaleString()} ·{" "}
                        {t.lastUsedAt
                          ? `Last used ${new Date(t.lastUsedAt).toLocaleString()}`
                          : "Never used"}
                      </div>
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Revoke token</AlertDialogTitle>
                          <AlertDialogDescription>
                            Any tool using <strong>{t.name}</strong> will
                            immediately lose access. This cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRevoke(t.id)}>
                            Revoke
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default PersonalAccessTokens;
