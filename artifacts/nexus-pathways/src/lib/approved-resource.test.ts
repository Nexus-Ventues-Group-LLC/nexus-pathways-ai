import { describe, expect, it } from 'vitest';
import { approvedResourceHref } from './approved-resource';

describe('approved learner resource navigation', () => {
  it('allows protected internal learner resource routes', () => {
    expect(approvedResourceHref('/learner/resources/learning-strategies'))
      .toBe('/learner/resources/learning-strategies');
  });

  it.each([
    'https://example.com/resource',
    '//example.com/resource',
    '/administrator/resources',
    '/learner/resources/../../administrator',
  ])('blocks unapproved or external destination %s', (route) => {
    expect(approvedResourceHref(route)).toBeNull();
  });
});