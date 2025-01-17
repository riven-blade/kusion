import React, { useEffect, useRef, useState } from 'react'
import { Button, DatePicker, Form, message, Space, Table, Tag, Select, Tooltip } from 'antd'
import type { TableColumnsType } from 'antd'
import { CloseOutlined, PlusOutlined, RedoOutlined } from '@ant-design/icons'
import { useLocation, useNavigate } from 'react-router-dom'
import queryString from 'query-string'
import { StackService } from '@kusionstack/kusion-api-client-sdk'
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import { RUNS_STATUS_MAP, RUNS_TYPES } from '@/utils/constants'
import GenerateDetail from './generateDetail'
import PreviewDetail from './previewDetail'
import RunsForm from './runsForm'

import styles from "./styles.module.less"

// use plugin
dayjs.extend(utc);
dayjs.extend(timezone);

const timeFormatter = 'YYYY-MM-DDTHH:mm:ssZ'

const Runs = ({ stackId, panelActiveKey }) => {
  const [form] = Form.useForm();
  const navigate = useNavigate()
  const location = useLocation();
  const { pageSize = 10, page = 1, total = 0, projectName, type, status, startTime, endTime, stackId: urlStackId } = queryString.parse(location?.search);
  const [dataSource, setDataSource] = useState([])
  const [open, setOpen] = useState<boolean>(false);
  const [searchParams, setSearchParams] = useState({
    pageSize,
    page,
    query: {
      type,
      status,
      startTime,
      endTime,
    },
    total,
  })
  const [generateOpen, setGenerateOpen] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [currentRecord, setCurrentRecord] = useState()
  const searchParamsRef = useRef<any>();

  useEffect(() => {
    const newParams = queryString.stringify({
      projectName,
      ...(searchParamsRef.current?.query || {}),
      stackId,
      page: Number(urlStackId) !== Number(stackId) ? 1 : searchParamsRef.current?.page,
      pageSize: searchParamsRef.current?.pageSize,
      panelKey: panelActiveKey
    })
    navigate(`?${newParams}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, navigate])

  async function createApply(values) {
    const response: any = await StackService.applyStackAsync({
      body: {
        ...values,
        stackID: Number(stackId),
        workspace: values?.workspace,
      },
      query: {
        workspace: values?.workspace,
        noCache: true,
      },
      path: {
        stackID: Number(stackId),
      }
    })
    return response
  }

  async function createGenerate(values) {
    const response: any = await StackService.generateStackAsync({
      body: {
        ...values,
        stackID: Number(stackId),
        workspace: values?.workspace,
      },
      query: {
        workspace: values?.workspace,
        noCache: true,
      },
      path: {
        stackID: Number(stackId),
      }
    })
    return response
  }

  async function createDestroy(values) {
    const response: any = await StackService.destroyStackAsync({
      body: {
        ...values,
        stackID: Number(stackId),
        workspace: values?.workspace,
      },
      query: {
        workspace: values?.workspace,
        noCache: true,
      },
      path: {
        stackID: Number(stackId),
      }
    })
    return response
  }

  async function createPreview(values) {
    const response: any = await StackService.previewStackAsync({
      body: {
        ...values,
        stackID: Number(stackId),
        workspace: values?.workspace,
      },
      query: {
        workspace: values?.workspace,
        output: 'json',
        noCache: true,
      },
      path: {
        stackID: Number(stackId),
      }
    })
    return response
  }

  async function handleSubmit(values, callback) {
    const type = values?.type;
    let response = undefined;
    if (type === 'Apply') {
      response = await createApply(values)
    } else if (type === 'Generate') {
      response = await createGenerate(values)
    } else if (type === 'Destroy') {
      response = await createDestroy(values)
    } else {
      response = await createPreview(values)
    }
    if (response?.data?.success) {
      message.success('Create Successful')
      setOpen(false)
      callback && callback()
      getListRun(searchParams)
    } else {
      message.error(response?.data?.message)
    }
  }
  function handleClose() {
    setOpen(false)
  }

  function handleReset() {
    form.resetFields();
    const newParams = {
      ...searchParams,
      query: undefined,
    }
    setSearchParams(newParams)
    searchParamsRef.current = newParams
    getListRun({
      page: 1,
      pageSize: 10,
      query: undefined,
    })
  }

  function handleSearch() {
    const values = form.getFieldsValue()
    const newParams = {
      ...searchParams,
      query: values,
    }
    setSearchParams(newParams)
    searchParamsRef.current = newParams
    getListRun({
      page: 1,
      pageSize: 10,
      query: values
    })
  }

  function handleClear(key) {
    form.setFieldValue(key, undefined)
    handleSearch()
  }

  async function getListRun(params) {
    try {
      let startTime, endTime
      if (params?.query?.createTime) {
        const [startDate, endDate] = params?.query?.createTime;
        startTime = dayjs(startDate).utc().format(timeFormatter)
        endTime = dayjs(endDate).utc().format(timeFormatter)
      }
      const response: any = await StackService.listRun({
        query: {
          type: params?.query?.type,
          status: params?.query?.status,
          startTime,
          endTime,
          pageSize: params?.pageSize || 10,
          page: params?.page,
          stackID: Number(stackId),
        }
      });
      if (response?.data?.success) {
        setDataSource(response?.data?.data?.runs);
        const newParams = {
          query: params?.query,
          pageSize: response?.data?.data?.pageSize,
          page: response?.data?.data?.currentPage,
          total: response?.data?.data?.total,
        }
        setSearchParams(newParams)
        searchParamsRef.current = newParams
      } else {
        message.error(response?.data?.messaage)
      }
    } catch (error) {
    }
  }

  useEffect(() => {
    let timer;
    if (stackId) {
      getListRun(searchParams)
      timer = setInterval(() => {
        getListRun(searchParamsRef.current)
      }, 7000)
    }
    return () => {
      if (timer) clearInterval(timer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stackId])

  function handleChangePage(page: number, pageSize: number) {
    getListRun({
      ...searchParams,
      page,
      pageSize,
    })
  }

  function handleCheckDetail(record) {
    setCurrentRecord(record)
    if (record?.type === 'Generate' || record?.type === 'Apply' || record?.type === 'Destroy') {
      setGenerateOpen(true)
    } else {
      setPreviewOpen(true)
    }

  }


  const columns: TableColumnsType<any> = [
    {
      title: 'Runs ID',
      dataIndex: 'id',
      fixed: 'left',
    },
    {
      title: 'Type',
      dataIndex: 'type',
    },
    {
      title: 'Create Time',
      dataIndex: 'creationTimestamp',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      render: (text) => {
        return <Tag color={text === 'Succeeded' ? 'success' : text === 'Failed' ? 'error' : 'warning'}>{RUNS_STATUS_MAP?.[text]}</Tag>
      }
    },
    {
      title: 'Action',
      dataIndex: 'action',
      fixed: 'right',
      width: 150,
      render: (_, record) => <Button style={{ padding: 0 }} type='link' onClick={() => handleCheckDetail(record)}>Detail</Button>
    },
  ]

  function handleCreateRuns() {
    setOpen(true)
  }

  function handlGenerateColse() {
    setGenerateOpen(false)
  }
  function handlePreviewClose() {
    setPreviewOpen(false)
  }

  function refresh() {
    getListRun(searchParams)
  }



  function renderTableTitle() {
    return <div className={styles.project_runs_toolbar}>
      <div className={styles.project_runs_toolbar_left}>
        {
          (searchParams?.total !== null || searchParams?.total !== undefined)
            ? <div className={styles.project_runs_result}>Total<Button style={{ padding: 4 }} type='link'>{searchParams?.total}</Button>results</div>
            : null
        }
        <div className={styles.projects_content_toolbar_list}>
          {
            searchParams?.query && Object.entries(searchParams?.query)?.filter(([key, _value]) => _value)?.map(([key, __value]: any) => {
              if (key === 'createTime') {
                const [startDate, endDate] = __value;
                const startTime = dayjs(startDate).utc().format(timeFormatter)
                const endTime = dayjs(endDate).utc().format(timeFormatter)
                return (
                  <div key={key} className={styles.projects_content_toolbar_item}>
                    {key}: {`${startTime} ~ ${endTime}`}
                    <CloseOutlined style={{ marginLeft: 10, color: '#140e3540' }} onClick={() => handleClear(key)} />
                  </div>
                )
              }
              return (
                <div key={key} className={styles.projects_content_toolbar_item}>
                  {key}: {__value}
                  <CloseOutlined style={{ marginLeft: 10, color: '#140e3540' }} onClick={() => handleClear(key)} />
                </div>
              )
            })
          }
        </div>
        {
          Object.entries(searchParams?.query || {})?.filter(([key, val]) => val)?.length > 0 && (
            <div className={styles.projects_content_toolbar_clear}>
              <Button type='link' onClick={handleReset} style={{ paddingLeft: 0 }}>Clear</Button>
            </div>
          )
        }
      </div>
      <div className={styles.projects_content_toolbar_create}>
        <Space>
          <Tooltip title={'Refresh'}>
            <Button
              style={{ color: '#646566', fontSize: 18 }}
              icon={<RedoOutlined />}
              onClick={refresh}
              type="text"
            />
          </Tooltip>
          <Button type="primary" onClick={handleCreateRuns}>
            <PlusOutlined /> New Runs
          </Button>
        </Space>
      </div>
    </div>
  }



  return (
    <div className={styles.project_runs}>
      {/* Search Form block*/}
      <div className={styles.project_runs_search}>
        <Form form={form} style={{ marginBottom: 0 }}>
          <Space>
            <Form.Item name="type" label="Type">
              <Select placeholder="Please select type" style={{ width: 150 }} allowClear>
                {
                  Object.entries(RUNS_TYPES)?.map(([key, value]) => <Select.Option key={key} value={value}>{value}</Select.Option>)
                }
              </Select>
            </Form.Item>
            <Form.Item name="status" label="Status">
              <Select placeholder="Please select status" style={{ width: 150 }} allowClear>
                {
                  Object.entries(RUNS_STATUS_MAP)?.map(([key, value]) => <Select.Option key={key} value={value}>{value}</Select.Option>)
                }
              </Select>
            </Form.Item>
            <Form.Item name="createTime" label="Create Time">
              <DatePicker.RangePicker allowClear showTime={{ format: 'HH:mm' }} />
            </Form.Item>
            <Form.Item style={{ marginLeft: 20 }}>
              <Space>
                <Button onClick={handleReset}>Reset</Button>
                <Button type='primary' onClick={handleSearch}>Search</Button>
              </Space>
            </Form.Item>
          </Space>
        </Form>
      </div>
      {/* Content block */}
      <div className={styles.project_runs_content}>
        {renderTableTitle()}
        <Table
          rowKey="id"
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: 1300 }}
          pagination={{
            total: Number(searchParams?.total),
            current: Number(searchParams?.page),
            pageSize: Number(searchParams?.pageSize),
            showTotal: (total, range) => (
              <div style={{
                fontSize: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end'
              }}>
                show{' '}
                <Select
                  value={searchParams?.pageSize}
                  size="small"
                  style={{
                    width: 60,
                    margin: '0 4px',
                    fontSize: '12px'
                  }}
                  onChange={(value) => handleChangePage(1, value as number)}
                  options={['10', '15', '20', '30', '40', '50', '75', '100'].map((value) => ({ value, label: value }))}
                />
                items, {range[0]}-{range[1]} of {total} items
              </div>
            ),
            size: "default",
            style: {
              marginTop: '16px',
              textAlign: 'right'
            },
            onChange: (page, size) => {
              handleChangePage(page, size);
            },
          }}
        />
        <RunsForm open={open} handleSubmit={handleSubmit} handleClose={handleClose} runsTypes={RUNS_TYPES} />
        <GenerateDetail currentRecord={currentRecord} open={generateOpen} handleClose={handlGenerateColse} />
        {
          previewOpen && <PreviewDetail currentRecord={currentRecord} open={previewOpen} handleClose={handlePreviewClose} />
        }
      </div>
    </div>
  )
}

export default Runs
