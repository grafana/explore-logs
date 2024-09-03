import { matcherHint, printExpected, printReceived } from 'jest-matcher-utils';
import { asapScheduler, Subscription, timer, isObservable, Observable } from 'rxjs';

export const OBSERVABLE_TEST_TIMEOUT_IN_MS = 1000;

function tryExpectations<T = unknown>(received: T[], expectations: (received: T[]) => void): jest.CustomMatcherResult {
  try {
    expectations(received);
    return {
      pass: true,
      message: () => `${matcherHint('.not.toEmitValues')}

  Expected observable to complete with
    ${printReceived(received)}
    `,
    };
  } catch (err) {
    return {
      pass: false,
      message: () => 'failed ' + err,
    };
  }
}

function forceObservableCompletion(
    subscription: Subscription,
    resolve: (args: jest.CustomMatcherResult | PromiseLike<jest.CustomMatcherResult>) => void
  ) {
    const timeoutObservable = timer(OBSERVABLE_TEST_TIMEOUT_IN_MS, asapScheduler);
  
    subscription.add(
      timeoutObservable.subscribe(() => {
        subscription.unsubscribe();
        resolve({
          pass: false,
          message: () =>
            `${matcherHint('.toEmitValues')}
  
      Expected ${printReceived('Observable')} to be ${printExpected(
        `completed within ${OBSERVABLE_TEST_TIMEOUT_IN_MS}ms`
      )} but it did not.`,
        });
      })
    );
  }
  
  function expectObservableToBeDefined(received: unknown): jest.CustomMatcherResult | null {
    if (received) {
      return null;
    }
  
    return {
      pass: false,
      message: () => `${matcherHint('.toEmitValues')}
  
  Expected ${printReceived(received)} to be ${printExpected('defined')}.`,
    };
  }
  
  function expectObservableToBeObservable(received: unknown): jest.CustomMatcherResult | null {
    if (isObservable(received)) {
      return null;
    }
  
    return {
      pass: false,
      message: () => `${matcherHint('.toEmitValues')}
  
  Expected ${printReceived(received)} to be ${printExpected('an Observable')}.`,
    };
  }
  
  function expectObservable(received: unknown): jest.CustomMatcherResult | null {
    const toBeDefined = expectObservableToBeDefined(received);
    if (toBeDefined) {
      return toBeDefined;
    }
  
    const toBeObservable = expectObservableToBeObservable(received);
    if (toBeObservable) {
      return toBeObservable;
    }
  
    return null;
  }
  

/**
 * Collect all the values emitted by the observables (also errors) and pass them to the expectations functions after
 * the observable ended (or emitted error). If Observable does not complete within OBSERVABLE_TEST_TIMEOUT_IN_MS the
 * test fails.
 */
export function toEmitValuesWith<T = unknown>(
  received: Observable<T>,
  expectations: (actual: T[]) => void
): Promise<jest.CustomMatcherResult> {
  const failsChecks = expectObservable(received);
  if (failsChecks) {
    return Promise.resolve(failsChecks);
  }

  return new Promise((resolve) => {
    const receivedValues: T[] = [];
    const subscription = new Subscription();

    subscription.add(
      received.subscribe({
        next: (value) => {
          receivedValues.push(value);
        },
        error: (err) => {
          receivedValues.push(err);
          subscription.unsubscribe();
          resolve(tryExpectations(receivedValues, expectations));
        },
        complete: () => {
          subscription.unsubscribe();
          resolve(tryExpectations(receivedValues, expectations));
        },
      })
    );

    forceObservableCompletion(subscription, resolve);
  });
}
