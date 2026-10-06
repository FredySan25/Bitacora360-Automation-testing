import { expect, type Locator, type Page, type Response } from "@playwright/test";
import { ui } from "../support/ui";

const text = ui.modules.habits.gym;

type SupabaseAccess = { restUrl: string; headers: Record<string, string> };

/** One workout in the list: its sets by exercise and the form that logs the next set. */
export class WorkoutCard {
  readonly exerciseInput: Locator;
  readonly repsInput: Locator;
  readonly weightInput: Locator;
  readonly addSetButton: Locator;
  readonly deleteButton: Locator;
  readonly noSetsMessage: Locator;

  constructor(readonly root: Locator) {
    this.exerciseInput = root.getByLabel(text.exerciseLabel, { exact: true });
    this.repsInput = root.getByLabel(text.repsLabel, { exact: true });
    this.weightInput = root.getByLabel(text.weightLabel, { exact: true });
    this.addSetButton = root.getByRole("button", { name: text.addSet });
    this.deleteButton = root.getByRole("button", { name: text.deleteWorkout });
    this.noSetsMessage = root.getByText(text.noSets);
  }

  /** Heading of the sets logged for one exercise. */
  exerciseHeading(name: string): Locator {
    return this.root.getByRole("heading", { level: 4, name, exact: true });
  }

  /** A logged set, by the text it shows ("10 × 60 kg"). */
  set(label: string): Locator {
    return this.root.getByRole("listitem").filter({ hasText: label });
  }

  deleteSetButton(label: string): Locator {
    return this.root.getByRole("button", { name: text.deleteSet(label), exact: true });
  }
}

/** Gym log at /habits/gym: the form that registers workouts, their cards and the progress chart. */
export class GymPage {
  readonly newWorkoutForm: Locator;
  readonly dateInput: Locator;
  readonly titleInput: Locator;
  readonly createButton: Locator;
  readonly showMoreButton: Locator;
  readonly progressSection: Locator;
  readonly progressExerciseSelect: Locator;
  readonly progressReadout: Locator;

  private access?: SupabaseAccess;
  private readonly createdWorkoutIds: string[] = [];
  private readonly usedExerciseNames = new Set<string>();

  constructor(readonly page: Page) {
    this.createButton = page.getByRole("button", { name: text.createSubmit });
    this.newWorkoutForm = page.locator("form").filter({ has: this.createButton });
    this.dateInput = this.newWorkoutForm.getByLabel(text.dateLabel);
    this.titleInput = this.newWorkoutForm.getByLabel(text.titleLabel);
    this.showMoreButton = page.getByRole("button", { name: text.showMore });
    this.progressSection = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: text.progressHeading }) });
    this.progressExerciseSelect = this.progressSection.getByLabel(text.exerciseLabel);
    this.progressReadout = this.progressSection.locator("figcaption");
  }

  async goto() {
    await this.page.goto("/habits/gym");
    // The form replaces the loading message once the workouts arrive, so by then React has hydrated
    await expect(this.createButton).toBeVisible();
  }

  /** Card of the workout with that title. The tests give every workout a title of its own. */
  card(title: string): WorkoutCard {
    return new WorkoutCard(this.cards().filter({ has: this.cardHeading(title) }));
  }

  /** The newest workout. A workout just registered goes on top of the list. */
  firstCard(): WorkoutCard {
    return new WorkoutCard(this.cards().first());
  }

  cardHeading(title: string): Locator {
    return this.page.getByRole("heading", { level: 3, name: title, exact: true });
  }

  /**
   * Registers a workout for the day in the form (today, unless the test changed it)
   * and remembers it so `deleteCreatedData` can remove it afterwards.
   */
  async createWorkout(title = ""): Promise<WorkoutCard> {
    await this.titleInput.fill(title);

    const saved = this.waitForInsert("workouts");
    await this.createButton.click();
    const { id } = await (await saved).json();
    this.createdWorkoutIds.push(id);

    return title ? this.card(title) : this.firstCard();
  }

  /** Logs a set in a workout and waits for the save. Without a weight it is a bodyweight set. */
  async addSet(card: WorkoutCard, set: { exercise: string; reps: number; weight?: number }) {
    await card.exerciseInput.fill(set.exercise);
    await card.repsInput.fill(String(set.reps));
    await card.weightInput.fill(set.weight === undefined ? "" : String(set.weight));
    // A new name creates the exercise on the fly, and it outlives the workout
    this.usedExerciseNames.add(set.exercise);

    const saved = this.waitForInsert("workout_sets");
    await card.addSetButton.click();
    await saved;
  }

  /**
   * The list starts with the latest workouts only, and the other tests register
   * theirs with the same user: shows more until this workout is on screen.
   */
  async showWorkout(title: string) {
    const heading = this.cardHeading(title);
    while (!(await heading.isVisible()) && (await this.showMoreButton.isVisible())) {
      await this.showMoreButton.click();
    }
  }

  /** Shows every workout, to tell that one is gone and not just further down. */
  async showAllWorkouts() {
    while (await this.showMoreButton.isVisible()) {
      await this.showMoreButton.click();
    }
  }

  /**
   * Deletes the workouts and exercises the test created straight through the
   * Supabase API, with the credentials of the browser session. Deleting a
   * workout deletes its sets, which is what lets the exercises go afterwards.
   */
  async deleteCreatedData() {
    if (!this.access) return;
    const { restUrl, headers } = this.access;

    for (const id of this.createdWorkoutIds.splice(0)) {
      await this.deleteRows(`${restUrl}/workouts`, { id: `eq.${id}` }, headers);
    }
    for (const name of this.usedExerciseNames) {
      await this.deleteRows(`${restUrl}/exercises`, { name: `eq.${name}` }, headers);
    }
    this.usedExerciseNames.clear();
  }

  private cards(): Locator {
    // The sets inside a card are list items too, but only a card has a title
    return this.page
      .getByRole("listitem")
      .filter({ has: this.page.getByRole("heading", { level: 3 }) });
  }

  /** Waits for the app to insert a row and keeps the session's credentials for the cleanup. */
  private async waitForInsert(table: string): Promise<Response> {
    const response = await this.page.waitForResponse(
      (candidate) =>
        new URL(candidate.url()).pathname === `/rest/v1/${table}` &&
        candidate.request().method() === "POST",
    );
    if (!response.ok()) {
      throw new Error(
        `Supabase answered ${response.status()} inserting into ${table}: ${await response.text()}`,
      );
    }

    const request = response.request();
    const { apikey, authorization } = await request.allHeaders();
    this.access = {
      restUrl: `${new URL(request.url()).origin}/rest/v1`,
      headers: { apikey, authorization },
    };
    return response;
  }

  private async deleteRows(
    endpoint: string,
    params: Record<string, string>,
    headers: Record<string, string>,
  ) {
    const response = await this.page.request.delete(endpoint, { params, headers });
    if (!response.ok()) {
      throw new Error(
        `Supabase answered ${response.status()} cleaning up ${endpoint}: ${await response.text()}`,
      );
    }
  }
}
