import React from "react";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardTitle, CardContent } from "@/components/ui/card";

describe("UI Components", () => {
  it("renders Button with default variant and text", () => {
    render(<Button>Click Me</Button>);
    const btn = screen.getByRole("button", { name: /click me/i });
    expect(btn).toBeInTheDocument();
  });

  it("renders Button in loading state with spinner and disabled", () => {
    render(<Button isLoading>Submitting</Button>);
    const btn = screen.getByRole("button");
    expect(btn).toBeDisabled();
  });

  it("renders Badge with testnet variant", () => {
    render(<Badge variant="testnet">MEZO TESTNET</Badge>);
    const badge = screen.getByText("MEZO TESTNET");
    expect(badge).toBeInTheDocument();
  });

  it("renders Card with Title and Content", () => {
    render(
      <Card>
        <CardTitle>Milestone Escrow</CardTitle>
        <CardContent>Content Body</CardContent>
      </Card>
    );
    expect(screen.getByText("Milestone Escrow")).toBeInTheDocument();
    expect(screen.getByText("Content Body")).toBeInTheDocument();
  });
});

