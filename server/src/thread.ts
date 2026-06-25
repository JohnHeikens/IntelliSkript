export function Sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

//from https://github.com/jagi/mutex/blob/master/src/Mutex.ts
export default class Mutex {
	private _locking: Promise<void>;
	private _locks: number;

	constructor() {

		this._locking = Promise.resolve();
		this._locks = 0;
	}

	isLocked() {

		return this._locks > 0;
	}

	lock() {

		this._locks += 1;

		let unlockNext: () => void;

		let willLock = new Promise<void>(resolve => unlockNext = () => {
			this._locks -= 1;

			resolve();
		});

		let willUnlock = this._locking.then(() => unlockNext);

		this._locking = this._locking.then(() => willLock);

		return willUnlock;
	}
}
// 1) A simple Deferred helper
export class Deferred<T> {
	promise: Promise<T>;
	resolve!: (value: T) => void;
	reject!: (err: any) => void;
	constructor() {
		this.promise = new Promise<T>((res, rej) => {
			this.resolve = res;
			this.reject = rej;
		});
	}
}