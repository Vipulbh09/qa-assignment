import { Locator, Page } from '@playwright/test';
import { Header } from './components/Header';

/** Behaviour shared by every storefront page. Page objects own all selectors; tests own none. */
export abstract class BasePage {
  readonly header: Header;

  constructor(protected readonly page: Page) {
    this.header = new Header(page);
  }

  /** The "session-id: ..." text in the footer. */
  get sessionId(): Locator {
    return this.page.getByTestId('session-id');
  }

  /** Current URL path, e.g. "/cart". */
  path(): string {
    return new URL(this.page.url()).pathname;
  }

  async reload(): Promise<void> {
    await this.page.reload();
  }

  /**
   * Make the next page load find an unreadable stored session, as if the browser's
   * localStorage had been damaged. Call before open().
   */
  async corruptStoredSession(): Promise<void> {
    await this.page.addInitScript(() => localStorage.setItem('session', 'not}{valid-json'));
  }
}
