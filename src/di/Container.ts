/**
 * Simple Dependency Injection Container
 */

type Factory<T> = (container: Container) => T;

interface ServiceRegistration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

export class Container {
  private services: Map<symbol, ServiceRegistration<any>> = new Map();

  /**
   * Register a service with a factory function
   */
  register<T>(
    serviceId: symbol,
    factory: Factory<T>,
    singleton: boolean = true,
  ): void {
    this.services.set(serviceId, {
      factory,
      singleton,
    });
  }

  /**
   * Register a singleton service
   */
  registerSingleton<T>(serviceId: symbol, factory: Factory<T>): void {
    this.register(serviceId, factory, true);
  }

  /**
   * Register a transient service (new instance each time)
   */
  registerTransient<T>(serviceId: symbol, factory: Factory<T>): void {
    this.register(serviceId, factory, false);
  }

  /**
   * Register a constant value
   */
  registerConstant<T>(serviceId: symbol, value: T): void {
    this.services.set(serviceId, {
      factory: () => value,
      singleton: true,
      instance: value,
    });
  }

  /**
   * Resolve a service by its identifier
   */
  resolve<T>(serviceId: symbol): T {
    const registration = this.services.get(serviceId);

    if (!registration) {
      throw new Error(`Service not registered: ${serviceId.toString()}`);
    }

    // Return existing singleton instance if available
    if (registration.singleton && registration.instance) {
      return registration.instance;
    }

    // Create new instance
    const instance = registration.factory(this);

    // Store singleton instance
    if (registration.singleton) {
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * Check if a service is registered
   */
  has(serviceId: symbol): boolean {
    return this.services.has(serviceId);
  }

  /**
   * Clear all registrations (mainly for testing)
   */
  clear(): void {
    this.services.clear();
  }
}
