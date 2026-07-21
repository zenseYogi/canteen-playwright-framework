import { BaseScreen } from './base.screen';

/**
 * Prep Tasks screen. Ported from prep_task_keywords.robot.
 */
export class PrepTasksScreen extends BaseScreen {
  // Same content-desc ("Prep tasks") on both the nav button and the screen
  // title - kept as distinct widget-typed xpaths, same reasoning as the
  // other nav-item-vs-title pairs across this port.
  private readonly navMenuPrepTask = '//android.widget.Button[@content-desc="Prep tasks"]';
  private readonly prepTasksTitle = '//android.view.View[@content-desc="Prep tasks"]';
  // Ported from prep_tasks.yaml's title_start_day - what RF's "...opened from
  // dashboard" keyword waits on after HomeScreen.tapStartDay() is called.
  private readonly titleStartDay = '//android.view.View[starts-with(@content-desc, "Start day")]';

  private readonly productCollection = '//android.widget.ImageView[starts-with(@content-desc, "Product collection")]';
  private readonly productCollectionTitle = '~Product Collection';
  // NOTE: NOT the same locator as MarketServiceScreen/VendingServiceScreen's
  // "Money Operations" trigger (a View, capital "Operations") - this is an
  // ImageView nav tile with lowercase "operations". Similar name, similar
  // purpose, different screen - kept separate, not hoisted/shared.
  private readonly moneyOperations = '//android.widget.ImageView[starts-with(@content-desc, "Money operations")]';
  private readonly additionalPrep = '//android.widget.ImageView[starts-with(@content-desc, "Additional prep")]';
  private readonly checks = '//android.widget.ImageView[starts-with(@content-desc, "Checks")]';

  private readonly completeButton = '~Complete';
  private readonly safetyCheckCompletedCheckbox = '//android.widget.ImageView[starts-with(@content-desc, "Safety check completed")]';
  // common.yaml's "Select All Checkboxes" keyword's target - only ever
  // actually invoked from this screen in the source reviewed, so kept local
  // rather than hoisted to BaseScreen (same reasoning as equipment_audit/fills).
  private readonly multipleCheckboxes = '//android.view.View/android.widget.ImageView[@clickable="true"]';
  private readonly quantityField = (productName: string) => `//android.widget.EditText[contains(@hint,"${productName}")]`;
  private readonly addButton = '~Add';

  async openFromHamburgerMenu(): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuPrepTask);
    await this.tap(this.navMenuPrepTask);
    await this.waitFor(this.prepTasksTitle);
    await this.waitFor(this.productCollection);
  }

  /** Confirms Prep Tasks loaded via the Dashboard's Start day button - see HomeScreen.tapStartDay(), which RF's "...from dashboard" keyword calls before this wait. */
  async waitForOpenedFromDashboard(): Promise<void> {
    await this.waitFor(this.titleStartDay);
  }

  private async openSubScreen(trigger: string): Promise<void> {
    await this.tap(this.hamburgerIcon);
    await this.waitFor(this.navMenuPrepTask);
    await this.tap(this.navMenuPrepTask);
    await this.waitFor(trigger);
    await this.tap(trigger);
  }

  /** Skip is identically shaped across all four prep-task sub-screens. */
  async skipSubScreen(trigger: string): Promise<void> {
    await this.openSubScreen(trigger);
    await this.tap(this.backButton);
    await this.tap(this.skipButton);
  }

  /**
   * Complete is identically shaped for Money Operations / Additional Prep /
   * Checks - NOT Product Collection, which has an extra photo-capture step
   * afterward (see completeProductCollection).
   */
  async completeSubScreen(trigger: string): Promise<void> {
    await this.openSubScreen(trigger);
    await this.tap(this.backButton);
    await this.tap(this.completeButton);
  }

  /**
   * Ported from "Perform Complete on the product collection screen" - after
   * Complete, the camera apparently auto-opens (RF just waits for the
   * shutter button, no trigger tap or Take Photo step), so this doesn't
   * reuse BaseScreen.capturePhoto() - that helper's shape (tap trigger ->
   * optional permission -> Take photo -> capture -> attach) doesn't match
   * what this keyword actually does.
   */
  async completeProductCollection(): Promise<void> {
    await this.completeSubScreen(this.productCollection);
    await this.waitFor(this.capturePhotoButton);
    await this.tap(this.capturePhotoButton);
    await this.tap(this.attachPhotoButton);
  }

  async addProductToCollection(searchTerm = 'can'): Promise<void> {
    await this.openSubScreen(this.productCollection);
    await this.waitFor(this.productCollectionTitle);
    await this.tap(this.addProductButton);
    const productName = await this.searchAndSelect(searchTerm);
    await this.type(this.quantityField(productName), '1');
    await this.tap(this.addButton);
  }

  /**
   * Ported from "Validate user is able to complete the prep task
   * successfully" - a single linear walk through all four sub-screens with
   * real data-entry actions (not skip, not the standalone Complete flow
   * above). Assumes Prep Tasks is already open (call openFromHamburgerMenu()
   * or waitForOpenedFromDashboard() first).
   *
   * Two sub-steps were commented out in the RF source and are deliberately
   * NOT reproduced - noting them here in case they're meant to be re-enabled
   * rather than intentionally dropped:
   * - Product Collection: "Select All Checkboxes" was commented out, while
   *   Money Operations and Additional Prep both DO select all checkboxes -
   *   looks like a deliberate omission rather than an oversight, but unconfirmed.
   * - Checks: clicking a "Vehicle check completed" checkbox + a "Dismiss"
   *   popup button were commented out - only the Safety check checkbox is
   *   actually clicked here.
   */
  async completeFullDayPrep(): Promise<void> {
    await this.waitFor(this.productCollection);
    await this.tap(this.productCollection);
    await this.waitFor(this.productCollectionTitle);
    await this.tap(this.continueButton);
    await this.waitFor(this.capturePhotoButton);
    await this.tap(this.capturePhotoButton);
    await this.tap(this.attachPhotoButton);

    await this.waitFor(this.moneyOperations);
    await this.tap(this.moneyOperations);
    await this.selectAllCheckboxes(this.multipleCheckboxes);
    await this.tap(this.continueButton);

    await this.tap(this.additionalPrep);
    await this.selectAllCheckboxes(this.multipleCheckboxes);
    await this.tap(this.continueButton);

    await this.waitFor(this.checks);
    await this.tap(this.checks);
    await this.tap(this.safetyCheckCompletedCheckbox);
    await this.tap(this.continueButton);

    await this.tap(this.startDayButton);
  }
}
