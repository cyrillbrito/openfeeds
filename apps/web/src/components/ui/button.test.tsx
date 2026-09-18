/**
 * The smoke test that matters for this stack: @kobalte/core@2.0.0-alpha.0 is
 * an ALPHA whose peer deps pin solid-js@2.0.0-rc.0 exactly. If that pairing
 * breaks, it breaks here — at render — rather than three components later.
 */
import { describe, expect, it } from 'vitest';
import { render } from '@solidjs/testing-library';

import { Button } from './button';

describe('Button', () => {
  it('renders a real button element with its label', () => {
    const { getByRole } = render(() => <Button>Add feed</Button>);
    expect(getByRole('button')).toHaveTextContent('Add feed');
  });

  it('merges caller classes over the variant classes', () => {
    // The cn()/tailwind-merge contract: a caller passing a conflicting
    // utility wins instead of both landing and source order deciding.
    const { getByRole } = render(() => (
      <Button variant="ghost" class="w-full">
        Wide
      </Button>
    ));
    expect(getByRole('button').className).toContain('w-full');
  });

  it('reflects the disabled state through Kobalte', () => {
    const { getByRole } = render(() => <Button disabled>Nope</Button>);
    expect(getByRole('button')).toBeDisabled();
  });
});
