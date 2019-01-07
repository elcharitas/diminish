import { LiteralObject, ProducerObject, Producer } from './Types'
import { ResolverObject, Resolver } from './Resolver'
import { Registry } from './Registry'

const KEY_REGEX = /[a-zA-Z_$][0-9a-zA-Z_$]*/

export class Container<ITypes = { [key:string] : any }> {
  private _registry = new Registry<ITypes>()

  public register (obj: ProducerObject<ITypes>)
  public register<Key extends keyof ITypes> (key: Key, producer: Producer<ITypes[Key]>)
  public register (...args) : void{
    let obj : ProducerObject<ITypes>

    switch (args.length) {
      case 1: obj = args[0]; break
      case 2: obj = { [args[0]]: args[1] } as ProducerObject<ITypes>; break
      default: throw new Error(`Expected 1 or 2 arguments. Got ${args.length}`)
    }

    const resolvers = {} as ResolverObject<ITypes>

    for (const key in obj) {
      if (!KEY_REGEX.test(key as string)) {
        throw new Error(`Error while registering key '${key}': Key must match ${KEY_REGEX}`)
      }

      resolvers[key] = new Resolver<any>(this._registry, key as string, obj[key])

      if (resolvers[key].isCircular()) {
        throw new Error(`Error while registering key '${key}': Producer has circular dependencies`)
      }
    }

    for (const key in resolvers) {
      this._registry.set(key, resolvers[key])
    }
  }

  public literal (obj: LiteralObject<ITypes>)
  public literal<Key extends keyof ITypes> (key: Key, value: ITypes[Key])
  public literal (...args) : void {
    let obj : LiteralObject<ITypes>

    switch (args.length) {
      case 1: obj = args[0]; break
      case 2: obj = { [args[0]]: args[1] } as LiteralObject<ITypes>; break
      default: throw new Error(`Expected 1 or 2 arguments. Got ${args.length}`)
    }

    for (const key in obj) {
      const producer : Producer<any> = () => obj[key]
      const resolver = new Resolver<any>(this._registry, key as string, producer)
      this._registry.set(key, resolver)
    }
  }

  public resolve<Key extends keyof ITypes> (key: Key) : ITypes[Key] | Promise<ITypes[Key]> {
    const resolver = this._registry.get<Key>(key)

    if (!(resolver instanceof Resolver)) {
      throw new Error(`Error while resolving ${key}: Not registered`)
    }

    try {
      return resolver.resolve(null)
    } catch (error) {
      throw new Error(`Error while resolving ${key}: ${error.message}`)
    }
  }

  public invoke<Result> (fn: Producer<Result>) : Result | Promise<Result>
  public invoke<Result> (context: any, fn: Producer<Result>) : Result | Promise<Result>
  public invoke<Result> (...args) : Result | Promise<Result> {
    let fn : Producer<Result>
    let context : any = null

    switch (args.length) {
      case 1: [fn] = args; break
      case 2: [context, fn] = args; break
      default: throw new Error(`Expected 1 or 2 arguments. Got ${args.length}`)
    }

    if (typeof fn !== 'function') {
      throw new Error(`Expected arg ${args.length} to be a function or class`)
    }

    const resolver = new Resolver<Result>(this._registry, '*', fn)
    return resolver.resolve(context)
  }
}
