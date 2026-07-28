import { BaseScreen } from './base.screen';
import type { Position } from '../utils/position';

/**
 * Coffee LOB - servicing a delivery location. Ported from coffee_keywords.robot.
 *
 * Deliberately NOT the same shape as Market/Vending's service screens -
 * Coffee's delivery flow includes a full document-signing/signature-capture
 * step that Market and Vending don't have at all, so this stays its own
 * class rather than forcing a shared "LOB service" base across all three
 * (see docs/rf-to-playwright-reuse.md's Phase 3 notes).
 */
export class CoffeeServiceScreen extends BaseScreen {
  private readonly coffeeLob = '//android.widget.ImageView[contains(@content-desc,"coffee")]';
  private readonly coffeeDeliveriesTitle = '~Deliveries';
  private readonly signingOrderTitle = '~Signing Order';
  private readonly clickToGetCustomerSignature = '//android.view.View[contains(@content-desc,"Customer signature here")]';
  // FRAGILE: deep structural path from coffee.yaml, no stable identifier -
  // re-verify against the current build.
  private readonly signatureScreen =
    '//android.widget.FrameLayout[@resource-id="android:id/content"]/android.widget.FrameLayout/android.view.View/android.view.View/android.view.View/android.view.View/android.view.View[5]';
  private readonly signOffButton = '~Sign off';
  private readonly equipmentAudit = '//android.view.View[starts-with(@content-desc, "Equipment audit")]';
  // Live-verified 2026-07-27 on a Coffee service stop (Route 10/TODAY,
  // "Alan B. Levan |NSU Broward Center of Innovation"'s checklist) -
  // Before Photos is the first tile, dashed border until completed/skipped.
  private readonly beforePhotos = '//android.view.View[starts-with(@content-desc,"Before Photos")]';

  // Excel TC001/TC002/TC003 "view the delivery header" - same shared
  // pattern as Market's own serviceStopLocationHeader (see that class's own
  // note on why it's a preceding-sibling of Before Photos, not a fixed
  // string - varies per location).
  private readonly serviceStopLocationHeader =
    '//android.view.View[starts-with(@content-desc,"Before Photos")]/preceding-sibling::android.view.View[1]';

  // Excel TC001-TC035 (Coffee "Header"/"Completing an equipment audit").
  // Live-verified 2026-07-28 (build 0.1.76, Route 10/YESTERDAY, "Alan B.
  // Levan |NSU Broward Center of Innovation" stop - this stop has ZERO
  // equipment on file, so only the screen's own title/header/empty-state
  // and the Add Equipment form's field layout were reachable this session;
  // the equipment-CARD-specific TCs (verify/mark-missing/persist-on-reopen)
  // need either a stop with pre-existing equipment or completing an actual
  // submission - not yet done, see coffee-service.spec.ts's own note).
  //
  // Same hint-encoding pattern as Market's Add Product screen: the
  // Account/Manufacturer/Model dropdown-style fields expose "{Label}\n
  // {Value}" as one content-desc, not separate elements.
  private readonly equipmentAuditTitle = '~Equipment audit';
  private readonly equipmentAuditEmptyStateHeading = '~Log equipment audit';
  private readonly equipmentAuditEmptyStateMessage =
    '~To add equipments to this service, please add equipment individually to this service location.';
  // The empty-state's own trigger is a plain View (not a Button) - distinct
  // from the Add Equipment form's own submit Button, which shares the same
  // "Add equipment" label (same disambiguation-by-tag-name pattern already
  // used for Market's Add Product screen).
  private readonly addEquipmentTrigger = '//android.view.View[@content-desc="Add equipment"]';
  private readonly addEquipmentTitle = '//android.view.View[@content-desc="Add equipment"]';
  private readonly addEquipmentSubmitButton = '//android.widget.Button[@content-desc="Add equipment"]';
  private addEquipmentFieldSelector(label: string): string {
    return `//android.view.View[starts-with(@content-desc,"${label}\n")]`;
  }

  async clickServiceLocation(position: Position): Promise<void> {
    await this.selectServiceLocation(this.coffeeLob, position);
  }

  async performDelivery(): Promise<void> {
    await this.tap(this.deliveryTrigger);
    await this.waitFor(this.coffeeDeliveriesTitle);
    await this.tap(this.continueButton);
    await this.waitFor(this.signingOrderTitle);
    await this.scrollDown();
    await this.tap(this.clickToGetCustomerSignature);
    await this.waitFor(this.signatureScreen);
    // RF tapped the signature pad twice here - kept as-is (first tap likely
    // focuses/opens the pad, second registers an actual stroke point).
    await this.tap(this.signatureScreen);
    await this.tap(this.signatureScreen);
    await this.tap(this.signOffButton);
    await this.tap(this.continueButton);
  }

  async performEquipmentAudit(): Promise<void> {
    await this.tap(this.equipmentAudit);
    await this.tap(this.doneButton);
    await this.tap(this.yesButton);
  }

  /** Opens the Before Photos step's "Add supporting photo" modal - see BaseScreen's openPhotoTrigger/isPhotoModalVisible/openSkipPhotoReasonSheet for the shared skip-photo flow beyond this. */
  async openBeforePhotos(): Promise<void> {
    await this.openPhotoTrigger(this.beforePhotos);
  }

  /** Excel TC001/TC002/TC003 "view the delivery header" - assumes the service stop's checklist screen is already open. */
  async isServiceStopLocationHeaderVisible(): Promise<boolean> {
    return this.isVisible(this.serviceStopLocationHeader);
  }

  async getServiceStopLocationHeaderText(): Promise<string> {
    const el = await this.driver.$(this.serviceStopLocationHeader);
    return (await el.getAttribute('content-desc')) ?? '';
  }

  /** Excel TC004/TC006 - opens Equipment audit and confirms its own page title. */
  async openEquipmentAudit(): Promise<void> {
    await this.tap(this.equipmentAudit);
    await this.waitFor(this.equipmentAuditTitle);
  }

  async isEquipmentAuditTitleVisible(): Promise<boolean> {
    return this.isVisible(this.equipmentAuditTitle);
  }

  /** Excel TC007 - header actions; live-verified 2026-07-28: Search is NOT present in the empty-state (no equipment to search yet) - only Back and Add equipment (section_header_add_cta). */
  async isEquipmentAuditHeaderActionsVisible(): Promise<{ addEquipment: boolean }> {
    return { addEquipment: await this.isVisible(this.addProductButton) };
  }

  /** Excel TC004's empty-state (this account's stop has zero equipment on file) - "Log equipment audit" heading + explanatory message + Add equipment/Done buttons. */
  async isEquipmentAuditEmptyStateVisible(): Promise<{ heading: boolean; message: boolean; addEquipment: boolean; done: boolean }> {
    return {
      heading: await this.isVisible(this.equipmentAuditEmptyStateHeading),
      message: await this.isVisible(this.equipmentAuditEmptyStateMessage),
      addEquipment: await this.isVisible(this.addEquipmentTrigger),
      done: await this.isVisible(this.doneButton)
    };
  }

  /** Excel TC030 - opens the Add Equipment form from the empty-state's own trigger, confirms its title. */
  async openAddEquipmentFromEmptyState(): Promise<void> {
    await this.tap(this.addEquipmentTrigger);
    await this.waitFor(this.addEquipmentTitle);
  }

  /** Excel TC033/TC034 - every mandatory field's own visibility, read in one shot. */
  async isAddEquipmentFormVisible(): Promise<{
    account: boolean;
    manufacturer: boolean;
    model: boolean;
    barcode: boolean;
    serialNumber: boolean;
    assetNumber: boolean;
    netTlmConnected: boolean;
    plumbed: boolean;
    photos: boolean;
  }> {
    return {
      account: await this.isVisible(this.addEquipmentFieldSelector('Account')),
      manufacturer: await this.isVisible(this.addEquipmentFieldSelector('Manufacturer')),
      model: await this.isVisible(this.addEquipmentFieldSelector('Model')),
      barcode: await this.isVisible('//android.widget.EditText[@hint="Barcode"]'),
      serialNumber: await this.isVisible('//android.widget.EditText[@hint="Serial Number"]'),
      assetNumber: await this.isVisible('//android.widget.EditText[@hint="Asset Number"]'),
      netTlmConnected: await this.isVisible(this.addEquipmentFieldSelector('Net/TLM Connected')),
      plumbed: await this.isVisible(this.addEquipmentFieldSelector('Plumbed')),
      photos: await this.isVisible(this.addEquipmentFieldSelector('Photos'))
    };
  }

  /** Excel TC035 - Add equipment submit button's enabled state (disabled grey until required fields are filled). */
  async isAddEquipmentSubmitEnabled(): Promise<boolean> {
    return this.isEnabled(this.addEquipmentSubmitButton);
  }

  async selectAddEquipmentDropdownOption(fieldLabel: string, optionLabel: string): Promise<void> {
    await this.tap(this.addEquipmentFieldSelector(fieldLabel));
    await this.tap(`~${optionLabel}`);
  }
}
