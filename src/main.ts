import { BUCKET, FILENAME } from './config';
import { downloaderS3 } from './helper';

(async () => {
    await downloaderS3(BUCKET, [{ key: FILENAME, filePath: FILENAME }]);
})();
