import type { JSXElement } from 'solid-js';

interface HeaderLinkProps {
  children: JSXElement;
}

export function HeaderLinkStyle(props: HeaderLinkProps) {
  return <span class="link link-hover font-semibold">{props.children}</span>;
}
