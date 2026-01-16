import type { ModalController } from '~/components/LazyModal';

export function useModalController(): [ModalController, (c: ModalController) => void] {
  let controller: ModalController = {
    open: () => {},
    close: () => {},
  };

  const setController = (c: ModalController) => {
    controller = c;
  };

  const proxyController: ModalController = {
    open: () => controller.open(),
    close: () => controller.close(),
  };

  return [proxyController, setController];
}
