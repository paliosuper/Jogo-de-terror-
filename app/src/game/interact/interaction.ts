import { distance, rectCenter, rectsOverlap, type Rect } from "../core/rect";

export interface InteractResult {
  message: string;
}

export interface Interactable {
  id: string;
  label: string;
  rect: Rect;
  /** Called when the player presses E while in reach. */
  onInteract: () => InteractResult | void;
  /** Optional visual state for placeholder rendering ("on"/"off"). */
  visualState?: () => "on" | "off";
}

export interface InteractEvent {
  item: Interactable;
  message: string;
}

/**
 * Generic interaction system: any object implements Interactable and is
 * registered here. No per-object code paths — doors, radio, photos and
 * notes all go through this same registry in later etapas.
 */
export class InteractionSystem {
  private items: Interactable[] = [];
  private readonly defaultReach = 76;

  register(item: Interactable): Interactable {
    this.items.push(item);
    return item;
  }

  /** Remove an item by id (e.g., after it was picked up). */
  remove(id: string): boolean {
    const before = this.items.length;
    this.items = this.items.filter((item) => item.id !== id);
    return this.items.length < before;
  }

  get(id: string): Interactable | null {
    return this.items.find((item) => item.id === id) ?? null;
  }

  get all(): readonly Interactable[] {
    return this.items;
  }

  /** Nearest interactable whose rect is within `reach` of the player rect. */
  nearest(playerRect: Rect, reach: number = this.defaultReach): Interactable | null {
    const pc = rectCenter(playerRect);
    let best: Interactable | null = null;
    let bestDist = Infinity;
    for (const item of this.items) {
      const c = rectCenter(item.rect);
      const d = distance(pc.x, pc.y, c.x, c.y);
      const inReach = rectsOverlap(playerRect, item.rect) || d <= reach;
      if (inReach && d < bestDist) {
        best = item;
        bestDist = d;
      }
    }
    return best;
  }

  /** Trigger the nearest interactable, if any. Returns null when out of reach. */
  interact(playerRect: Rect, reach: number = this.defaultReach): InteractEvent | null {
    const item = this.nearest(playerRect, reach);
    if (!item) return null;
    const result = item.onInteract();
    const message = result?.message ?? `${item.label}: OK`;
    return { item, message };
  }
}
